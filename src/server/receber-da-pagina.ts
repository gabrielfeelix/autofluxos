import 'server-only'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import { nomeNoMessenger } from './messenger/conexao'
import { acharCanalPorPagina } from './repos/canais-messenger'
import { lerTokenDoCanal } from './repos/conversas'
import { responderComentario } from './receber-comentario-do-instagram'
import { paraMensagemInterna, webhookDoInstagramSchema } from './receber-do-instagram'
import { responderNoComentarioDaPagina, responderNoDirectDaPagina } from './messenger/comentarios'
import { z } from 'zod'
import { tratarUma } from './receber-mensagem'

/**
 * O que chega do objeto `page` da Meta que não é lead: direct do Messenger e
 * comentário na página.
 *
 * **O formato do Messenger é o do Instagram**, `entry[].messaging[]` com
 * `sender`, `recipient` e o mesmo `message` (`mid`, `text`, `quick_reply`,
 * `attachments`, `is_echo`). Por isso a leitura e a tradução são as de
 * `receber-do-instagram.ts`; aqui muda só quem é o canal (a página, pelo
 * `recipient.id`) e de onde vem o nome de quem escreveu.
 *
 * Eco não chega: o app não assina `message_echoes`. Se um dia assinar, o
 * `is_echo` cai no `paraMensagemInterna`, que o descarta.
 */
export async function receberDaPagina(payload: unknown): Promise<void> {
  const analise = webhookDoInstagramSchema.safeParse(payload)
  if (!analise.success) return

  for (const entrada of analise.data.entry) {
    for (const evento of entrada.messaging) {
      if (!evento?.message || evento.message.is_echo) continue

      const canal = await acharCanalPorPagina(evento.recipient.id)
      if (!canal) {
        await alertar(
          'o Messenger mandou mensagem para uma página que não está ligada a nenhum cliente',
          new Error(`recipient.id ${evento.recipient.id} não casa com nenhum channels.fb_page_id`),
          { recipiente: evento.recipient.id },
        )
        continue
      }
      if (canal.status !== 'ativo') continue

      const mensagem = paraMensagemInterna(evento.sender.id, evento.message)
      if (!mensagem) continue

      const adaptador = await adaptadorDoCanal(canal)
      const nome = await nomeNoMessenger(evento.sender.id, await lerTokenDoCanal(canal))
      await tratarUma(canal, mensagem, nome, () => adaptador)
    }

    for (const mudanca of entrada.changes) {
      if (mudanca?.field !== 'feed' || !entrada.id) continue
      await tratarComentarioDaPagina(entrada.id, mudanca.value)
    }
  }
}

/**
 * O comentário do campo `feed`. O mesmo campo traz curtida, post novo,
 * compartilhamento e edição; só `item: comment` com `verb: add` interessa.
 * `from` falta quando a Meta não pode dizer quem foi, e aí o direct sai do
 * mesmo jeito (ele precisa só do `comment_id`).
 */
const comentarioDaPaginaSchema = z.object({
  item: z.literal('comment'),
  verb: z.literal('add'),
  comment_id: z.string(),
  post_id: z.string(),
  message: z.string().default(''),
  from: z.object({ id: z.string(), name: z.string().optional() }).optional(),
})

async function tratarComentarioDaPagina(pageId: string, valor: unknown): Promise<void> {
  const lido = comentarioDaPaginaSchema.safeParse(valor)
  if (!lido.success) return
  const comentario = lido.data

  // A resposta pública é um comentário da própria página: sem isto, laço.
  if (comentario.from?.id === pageId) return

  const canal = await acharCanalPorPagina(pageId)
  if (!canal || canal.status !== 'ativo') return

  await responderComentario({
    canal,
    rede: 'Facebook',
    comentario: {
      id: comentario.comment_id,
      texto: comentario.message,
      postId: comentario.post_id,
      autorId: comentario.from?.id ?? null,
      autorNome: comentario.from?.name ?? null,
    },
    direct: (token, texto) => responderNoDirectDaPagina({ token, comentarioId: comentario.comment_id, texto }),
    publica: (token, texto) => responderNoComentarioDaPagina({ token, comentarioId: comentario.comment_id, texto }),
  })
}

/** O corpo traz algo para o Inbox (mensagem ou comentário), e não só lead? */
export function temAlgoParaOInbox(payload: unknown): boolean {
  const corpo = payload as { object?: unknown; entry?: { messaging?: unknown[]; changes?: { field?: unknown }[] }[] } | null
  if (corpo?.object !== 'page' || !Array.isArray(corpo.entry)) return false
  return corpo.entry.some(
    (entrada) =>
      (Array.isArray(entrada.messaging) && entrada.messaging.length > 0) ||
      (Array.isArray(entrada.changes) && entrada.changes.some((mudanca) => mudanca?.field === 'feed')),
  )
}
