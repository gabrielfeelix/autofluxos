import 'server-only'
import type { PostDoInstagram } from '../instagram/comentarios'

/**
 * Comentário em post da página do Facebook: o direct, a resposta pública e a
 * lista de posts para a regra. Mesmos três gestos do Instagram
 * (`instagram/comentarios.ts`), na Graph API do Facebook e com o token da
 * página.
 */

const VERSAO = 'v25.0'
const TIMEOUT_MS = 15_000

async function pedir(url: string | URL, init: RequestInit & { token: string }): Promise<unknown> {
  const { token, ...resto } = init
  const resposta = await fetch(url, {
    ...resto,
    headers: { ...(resto.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`o Facebook respondeu ${resposta.status}: ${texto.slice(0, 400)}`)
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`o Facebook devolveu algo que não é JSON: ${texto.slice(0, 200)}`)
  }
}

/**
 * O direct de quem comentou (resposta privada). A Meta devolve o
 * `recipient_id`, que é o id da pessoa no Messenger: é com ele que o contato
 * nasce, para a resposta dela cair na mesma conversa.
 */
export async function responderNoDirectDaPagina(opcoes: {
  token: string
  comentarioId: string
  texto: string
}): Promise<{ mensagemId: string | null; destinatarioId: string | null }> {
  const corpo = (await pedir(`https://graph.facebook.com/${VERSAO}/me/messages`, {
    method: 'POST',
    token: opcoes.token,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: opcoes.comentarioId }, message: { text: opcoes.texto } }),
  })) as { message_id?: unknown; recipient_id?: unknown } | null
  return {
    mensagemId: typeof corpo?.message_id === 'string' ? corpo.message_id : null,
    destinatarioId: typeof corpo?.recipient_id === 'string' ? corpo.recipient_id : null,
  }
}

/** A resposta pública, embaixo do comentário. */
export async function responderNoComentarioDaPagina(opcoes: {
  token: string
  comentarioId: string
  texto: string
}): Promise<void> {
  await pedir(`https://graph.facebook.com/${VERSAO}/${opcoes.comentarioId}/comments`, {
    method: 'POST',
    token: opcoes.token,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: opcoes.texto }),
  })
}

/** Os posts recentes da página, no mesmo formato dos do Instagram. */
export async function postsDaPagina(opcoes: { token: string; limite?: number }): Promise<PostDoInstagram[]> {
  const url = new URL(`https://graph.facebook.com/${VERSAO}/me/posts`)
  url.searchParams.set('fields', 'id,message,full_picture,permalink_url,created_time,status_type')
  url.searchParams.set('limit', String(opcoes.limite ?? 24))
  const corpo = (await pedir(url, { token: opcoes.token })) as { data?: unknown } | null
  if (!Array.isArray(corpo?.data)) return []
  return corpo.data.flatMap((linha) => {
    const l = linha as Record<string, unknown>
    if (typeof l.id !== 'string') return []
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
    return [
      {
        id: l.id,
        legenda: texto(l.message),
        imagem: texto(l.full_picture),
        link: texto(l.permalink_url),
        tipo: 'IMAGE',
        publicadoEm: texto(l.created_time),
      },
    ]
  })
}
