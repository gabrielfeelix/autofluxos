import 'server-only'
import { z } from 'zod'
import { escolherResposta } from '@/core/comentarios'
import { alertar } from './alertar'
import { responderNoComentario, responderNoDirect } from './instagram/comentarios'
import { registrarMensagemDeCoexistencia } from './repos/coexistencia'
import { type CanalSalvo, acharCanalPorContaDoInstagram, acharOuCriarContato, lerTokenDoCanal } from './repos/conversas'
import {
  concluirComentario,
  reservarComentario,
  respostasAtivasDoCanal,
} from './repos/respostas-a-comentarios'

/**
 * Um comentário novo num post vira direct para quem comentou.
 *
 * Chega no mesmo endereço do direct, mas em outro formato:
 * `entry[].changes[]` com `field: "comments"`, e não `entry[].messaging[]`.
 * `entry[].id` é a conta do cliente; `value.from.id` é quem comentou, e é o
 * mesmo IGSID que aparece como `sender.id` quando essa pessoa manda direct.
 */
export const comentarioSchema = z.object({
  id: z.string(),
  text: z.string().default(''),
  from: z.object({ id: z.string(), username: z.string().optional() }),
  media: z.object({ id: z.string() }),
})

export type ComentarioDoInstagram = z.infer<typeof comentarioSchema>

export async function tratarComentario(contaId: string, comentario: ComentarioDoInstagram): Promise<void> {
  /*
   * A nossa própria resposta pública também chega aqui, como comentário novo
   * feito pela conta. Sem esta linha, responder em público gera um comentário,
   * que gera outra resposta, e o post vira um laço.
   */
  if (comentario.from.id === contaId) return

  const canal = await acharCanalPorContaDoInstagram(contaId)
  if (!canal || canal.status !== 'ativo') return

  await responderComentario({
    canal,
    rede: 'Instagram',
    comentario: {
      id: comentario.id,
      texto: comentario.text,
      postId: comentario.media.id,
      autorId: comentario.from.id,
      autorNome: comentario.from.username ?? null,
    },
    direct: async (token, texto) => {
      const mensagemId = await responderNoDirect({ igUserId: contaId, token, comentarioId: comentario.id, texto })
      return { mensagemId, destinatarioId: null }
    },
    publica: (token, texto) => responderNoComentario({ token, comentarioId: comentario.id, texto }),
  })
}

/** Um comentário, já sem o formato de cada rede. */
export type ComentarioRecebido = {
  id: string
  texto: string
  postId: string
  /** Quem comentou, pelo id da rede. Nulo quando a Meta não manda `from`. */
  autorId: string | null
  autorNome: string | null
}

/**
 * O caminho comum de Instagram e página do Facebook: escolher a regra,
 * reservar o comentário, mandar o direct, gravar no Inbox, responder em
 * público e concluir. O que muda entre as redes é só como se manda, e isso
 * entra pronto em `direct` e `publica`.
 *
 * `destinatarioId` existe por causa do Facebook: o `from.id` do comentário não
 * é o id que a pessoa terá no Messenger, e quem diz qual é o `recipient_id`
 * da resposta ao direct. Sem ele, a resposta da pessoa abriria outro contato.
 */
export async function responderComentario(entrada: {
  canal: CanalSalvo
  rede: 'Instagram' | 'Facebook'
  comentario: ComentarioRecebido
  direct: (token: string, texto: string) => Promise<{ mensagemId: string | null; destinatarioId: string | null }>
  publica: (token: string, texto: string) => Promise<void>
}): Promise<void> {
  const { canal, comentario } = entrada

  const resposta = escolherResposta(await respostasAtivasDoCanal(canal.id), {
    postId: comentario.postId,
    texto: comentario.texto,
  })
  if (!resposta) return

  const reservado = await reservarComentario({
    comentarioId: comentario.id,
    clienteId: canal.clienteId,
    respostaId: resposta.id,
    autorIgsid: comentario.autorId,
  })
  if (!reservado) return

  let contatoId: string | null = null
  try {
    const token = await lerTokenDoCanal(canal)
    const { mensagemId, destinatarioId } = await entrada.direct(token, resposta.mensagem)

    /*
     * A conversa nasce no Inbox com o direct que saiu, para quem atende ver de
     * onde a pessoa veio quando ela responder. O eco da Meta traz o mesmo id e
     * é descartado como repetido.
     */
    const idDoContato = destinatarioId ?? comentario.autorId
    if (idDoContato) {
      const contato = await acharOuCriarContato(canal.clienteId, idDoContato, comentario.autorNome)
      contatoId = contato.id
      await registrarMensagemDeCoexistencia({
        contatoId: contato.id,
        waMessageId: mensagemId ?? `comentario:${comentario.id}`,
        direcao: 'saida',
        texto: resposta.mensagem,
        payload: {
          autor: { tipo: 'automacao' },
          origem: 'comentario',
          comentario: { id: comentario.id, texto: comentario.texto.slice(0, 500), postId: comentario.postId },
        },
        ts: null,
        historico: false,
      })
    }

    // A resposta pública é enfeite: falhar nela não desfaz o direct que já saiu.
    let detalhe: string | null = null
    if (resposta.respostaPublica) {
      try {
        await entrada.publica(token, resposta.respostaPublica)
      } catch (erro) {
        detalhe = `o direct saiu, a resposta pública não: ${erro instanceof Error ? erro.message : erro}`
        console.warn(`[${entrada.rede}] resposta pública ao comentário falhou`, erro)
      }
    }

    // O contato vai junto: é por ele que a primeira resposta da pessoa acha o
    // fluxo da regra (`comentarioEsperandoResposta`).
    await concluirComentario({ comentarioId: comentario.id, respostaId: resposta.id, ok: true, detalhe, contatoId })
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro)
    await concluirComentario({ comentarioId: comentario.id, respostaId: resposta.id, ok: false, detalhe: motivo, contatoId })
    await alertar(`a resposta automática a um comentário do ${entrada.rede} falhou`, erro, {
      cliente: canal.clienteId,
      resposta: resposta.id,
    })
  }
}
