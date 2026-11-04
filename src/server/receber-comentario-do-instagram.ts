import 'server-only'
import { z } from 'zod'
import { escolherResposta } from '@/core/comentarios'
import { alertar } from './alertar'
import { responderNoComentario, responderNoDirect } from './instagram/comentarios'
import { registrarMensagemDeCoexistencia } from './repos/coexistencia'
import { acharCanalPorContaDoInstagram, acharOuCriarContato, lerTokenDoCanal } from './repos/conversas'
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

  const resposta = escolherResposta(await respostasAtivasDoCanal(canal.id), {
    postId: comentario.media.id,
    texto: comentario.text,
  })
  if (!resposta) return

  const reservado = await reservarComentario({
    comentarioId: comentario.id,
    clienteId: canal.clienteId,
    respostaId: resposta.id,
    autorIgsid: comentario.from.id,
  })
  if (!reservado) return

  let contatoId: string | null = null
  try {
    const token = await lerTokenDoCanal(canal)
    const mensagemId = await responderNoDirect({
      igUserId: contaId,
      token,
      comentarioId: comentario.id,
      texto: resposta.mensagem,
    })

    /*
     * A conversa nasce no Inbox com o direct que saiu, para quem atende ver de
     * onde a pessoa veio quando ela responder. O eco da Meta traz o mesmo id e
     * é descartado como repetido.
     */
    const contato = await acharOuCriarContato(canal.clienteId, comentario.from.id, comentario.from.username ?? null)
    contatoId = contato.id
    await registrarMensagemDeCoexistencia({
      contatoId: contato.id,
      waMessageId: mensagemId ?? `comentario:${comentario.id}`,
      direcao: 'saida',
      texto: resposta.mensagem,
      payload: {
        autor: { tipo: 'automacao' },
        origem: 'comentario',
        comentario: { id: comentario.id, texto: comentario.text.slice(0, 500), postId: comentario.media.id },
      },
      ts: null,
      historico: false,
    })

    // A resposta pública é enfeite: falhar nela não desfaz o direct que já saiu.
    let detalhe: string | null = null
    if (resposta.respostaPublica) {
      try {
        await responderNoComentario({ token, comentarioId: comentario.id, texto: resposta.respostaPublica })
      } catch (erro) {
        detalhe = `o direct saiu, a resposta pública não: ${erro instanceof Error ? erro.message : erro}`
        console.warn('[instagram] resposta pública ao comentário falhou', erro)
      }
    }

    // O contato vai junto: é por ele que a primeira resposta da pessoa acha o
    // fluxo da regra (`comentarioEsperandoResposta`).
    await concluirComentario({ comentarioId: comentario.id, respostaId: resposta.id, ok: true, detalhe, contatoId })
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro)
    await concluirComentario({ comentarioId: comentario.id, respostaId: resposta.id, ok: false, detalhe: motivo, contatoId })
    await alertar('a resposta automática a um comentário do Instagram falhou', erro, {
      cliente: canal.clienteId,
      resposta: resposta.id,
    })
  }
}
