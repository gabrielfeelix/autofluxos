import 'server-only'
import { z } from 'zod'
import { pedir, versaoDoGraph } from './conexao'

/**
 * As três chamadas da resposta a comentário, todas em `graph.instagram.com`.
 *
 * - **Direct para quem comentou** ("private reply"): `POST /{conta}/messages`
 *   com `recipient.comment_id` no lugar do id da pessoa. A Meta aceita **uma**
 *   mensagem por comentário, em até 7 dias. Se a pessoa responder, abre a
 *   janela normal de 24h e a conversa segue como qualquer direct.
 * - **Resposta pública**: `POST /{comentario}/replies`. Precisa de
 *   `instagram_business_manage_comments`.
 * - **Posts recentes**: `GET /{conta}/media`, para a tela escolher o post pela
 *   foto e não por um id de 17 dígitos.
 */

const enviadoSchema = z.object({ message_id: z.string().optional() })

/** Manda o direct para quem comentou. Devolve o id da mensagem na Meta. */
export async function responderNoDirect(opcoes: {
  igUserId: string
  token: string
  comentarioId: string
  texto: string
}): Promise<string | null> {
  const lido = enviadoSchema.parse(
    await pedir(`https://graph.instagram.com/${versaoDoGraph()}/${opcoes.igUserId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opcoes.token}` },
      body: JSON.stringify({
        recipient: { comment_id: opcoes.comentarioId },
        message: { text: opcoes.texto },
      }),
    }),
  )
  return lido.message_id ?? null
}

/** Responde o comentário em público, embaixo dele. */
export async function responderNoComentario(opcoes: {
  token: string
  comentarioId: string
  texto: string
}): Promise<void> {
  await pedir(`https://graph.instagram.com/${versaoDoGraph()}/${opcoes.comentarioId}/replies`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${opcoes.token}` },
    body: new URLSearchParams({ message: opcoes.texto }),
  })
}

export type PostDoInstagram = {
  id: string
  legenda: string | null
  imagem: string | null
  link: string | null
  tipo: string
  publicadoEm: string | null
}

const midiaSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        caption: z.string().optional(),
        media_type: z.string().optional(),
        media_url: z.string().optional(),
        thumbnail_url: z.string().optional(),
        permalink: z.string().optional(),
        timestamp: z.string().optional(),
      }),
    )
    .default([]),
})

/**
 * Os posts mais recentes da conta, com a miniatura.
 *
 * Vídeo e reel trazem a imagem em `thumbnail_url`; foto e carrossel, em
 * `media_url`. Pegar só a segunda deixaria todo reel sem capa na tela.
 */
export async function postsRecentes(opcoes: {
  igUserId: string
  token: string
  limite?: number
}): Promise<PostDoInstagram[]> {
  const url = new URL(`https://graph.instagram.com/${versaoDoGraph()}/${opcoes.igUserId}/media`)
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp')
  url.searchParams.set('limit', String(opcoes.limite ?? 24))
  url.searchParams.set('access_token', opcoes.token)

  const lido = midiaSchema.parse(await pedir(url.toString()))
  return lido.data.map((m) => ({
    id: m.id,
    legenda: m.caption?.trim() || null,
    imagem: m.thumbnail_url ?? m.media_url ?? null,
    link: m.permalink ?? null,
    tipo: m.media_type ?? 'IMAGE',
    publicadoEm: m.timestamp ?? null,
  }))
}
