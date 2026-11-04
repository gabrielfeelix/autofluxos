import 'server-only'

/**
 * Ligar uma página do Facebook ao Inbox (Messenger e comentários da página).
 *
 * Facebook Login comum, como o de Anúncios (`anuncios/conexao.ts`): a pessoa
 * autoriza, o código vira token de usuário de longa duração, e de
 * `me/accounts` sai o **token da página**. Token de página tirado de token de
 * usuário longo não expira, e é ele que vai para o Vault.
 *
 * Os escopos são os da revisão da Meta para o Messenger e os comentários:
 * ler a lista de páginas, mandar e receber mensagem, assinar o webhook da
 * página, ler e responder comentário.
 */

const VERSAO = 'v25.0'
export const RETORNO_DO_MESSENGER = '/api/messenger/retorno'

export const ESCOPOS_DO_MESSENGER = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_engagement',
  /*
   * Página que pertence a um portfólio de negócios só sai em `me/accounts` com
   * esta permissão. Sem ela a lista volta vazia mesmo para quem administra
   * tudo (04/nov/2026: as quatro páginas do Portfólio 4YU sumiram).
   */
  'business_management',
] as const

/** Os campos do webhook `page` que o Inbox precisa. */
const CAMPOS_DO_INBOX = ['messages', 'messaging_postbacks', 'feed']

export function urlDeAutorizacaoDoMessenger(opcoes: { origem: string; state: string }): string {
  const appId = process.env.META_APP_ID
  if (!appId) throw new Error('falta META_APP_ID no ambiente')
  const url = new URL(`https://www.facebook.com/${VERSAO}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', `${opcoes.origem}${RETORNO_DO_MESSENGER}`)
  url.searchParams.set('state', opcoes.state)
  url.searchParams.set('scope', ESCOPOS_DO_MESSENGER.join(','))
  // Quem recusou uma permissão antes ganha a pergunta de novo, em vez de a
  // Meta lembrar a recusa em silêncio e a página chegar sem `pages_messaging`.
  url.searchParams.set('auth_type', 'rerequest')
  return url.toString()
}

export type PaginaComToken = { id: string; nome: string; token: string }

/** As páginas que a pessoa liberou, cada uma com o token dela. */
export async function paginasComToken(tokenDoUsuario: string): Promise<PaginaComToken[]> {
  const url = new URL(`https://graph.facebook.com/${VERSAO}/me/accounts`)
  url.searchParams.set('fields', 'id,name,access_token')
  url.searchParams.set('limit', '100')
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenDoUsuario}` }, cache: 'no-store' })
  const corpo = (await r.json().catch(() => null)) as { data?: unknown } | null
  if (!r.ok || !Array.isArray(corpo?.data)) return []
  return corpo.data.flatMap((linha) => {
    const l = linha as { id?: unknown; name?: unknown; access_token?: unknown }
    if (typeof l.id !== 'string' || typeof l.access_token !== 'string') return []
    return [{ id: l.id, nome: typeof l.name === 'string' ? l.name : '', token: l.access_token }]
  })
}

/**
 * Inscreve o app na página, **somando** aos campos que já estavam lá.
 *
 * O `POST subscribed_apps` substitui a lista do app na página. A mesma página
 * pode já estar inscrita em `leadgen` pelo Lead Ads, e mandar só os campos do
 * Inbox desligaria os leads em silêncio. Por isso lê antes e manda a união.
 */
export async function inscreverPagina(pageId: string, tokenDaPagina: string): Promise<void> {
  const base = `https://graph.facebook.com/${VERSAO}/${pageId}/subscribed_apps`
  const cabecalho = { Authorization: `Bearer ${tokenDaPagina}` }

  const atual = await fetch(base, { headers: cabecalho, cache: 'no-store' })
  const lido = (await atual.json().catch(() => null)) as {
    data?: { id?: string; subscribed_fields?: string[] }[]
  } | null
  const doApp = lido?.data?.find((app) => app.id === process.env.META_APP_ID)
  const campos = new Set([...(doApp?.subscribed_fields ?? []), ...CAMPOS_DO_INBOX])

  const url = new URL(base)
  url.searchParams.set('subscribed_fields', [...campos].join(','))
  const r = await fetch(url, { method: 'POST', headers: cabecalho, cache: 'no-store' })
  const corpo = (await r.json().catch(() => null)) as { success?: unknown; error?: { message?: unknown } } | null
  if (!r.ok || corpo?.success !== true) {
    const detalhe = typeof corpo?.error?.message === 'string' ? corpo.error.message : `HTTP ${r.status}`
    throw new Error(`a Meta recusou a inscrição da página: ${detalhe}`)
  }
}

/**
 * O nome de quem mandou mensagem para a página (User Profile API).
 *
 * Falha devolve `null`: nome é enfeite do Inbox, a mensagem não pode se perder
 * junto com ele.
 */
export async function nomeNoMessenger(psid: string, tokenDaPagina: string): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${VERSAO}/${psid}`)
  url.searchParams.set('fields', 'first_name,last_name')
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenDaPagina}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    const corpo = (await r.json().catch(() => null)) as { first_name?: unknown; last_name?: unknown } | null
    if (!r.ok || !corpo) return null
    const nome = [corpo.first_name, corpo.last_name].filter((parte) => typeof parte === 'string' && parte).join(' ')
    return nome || null
  } catch {
    return null
  }
}

/** O link da foto de perfil de quem escreveu para a página. `null` se não der. */
export async function fotoNoMessenger(psid: string, tokenDaPagina: string): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${VERSAO}/${psid}`)
  url.searchParams.set('fields', 'profile_pic')
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenDaPagina}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    const corpo = (await r.json().catch(() => null)) as { profile_pic?: unknown } | null
    return r.ok && typeof corpo?.profile_pic === 'string' ? corpo.profile_pic : null
  } catch {
    return null
  }
}
