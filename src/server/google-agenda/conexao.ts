import 'server-only'
import type { ResultadoDaAgenda } from '@/agendas/types'

/**
 * Ligar o Google Agenda de uma conta.
 *
 * O mesmo cliente OAuth do login com Google (`GOOGLE_CLIENT_ID`), com um
 * escopo a mais: `calendar.events`, ler e criar eventos. É escopo sensível:
 * até 100 usuários de teste funcionam sem a verificação do Google, e a
 * verificação pede o vídeo do fluxo (PENDENCIAS-DO-GABRIEL.md).
 *
 * `access_type=offline` com `prompt=consent` garante o **refresh token**, que
 * é o que vai para o cofre. Sem `prompt=consent`, quem já autorizou uma vez
 * volta sem refresh token e a agenda pararia em uma hora.
 */

export const RETORNO_DO_GOOGLE_AGENDA = '/api/google-agenda/retorno'
const ESCOPOS = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events']

export function googleAgendaConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function urlDeAutorizacaoDoGoogle(opcoes: { origem: string; state: string }): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('falta GOOGLE_CLIENT_ID no ambiente')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${opcoes.origem}${RETORNO_DO_GOOGLE_AGENDA}`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', ESCOPOS.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', opcoes.state)
  return url.toString()
}

/** O código vira refresh token e o e-mail da conta que autorizou. */
export async function trocarCodigoDoGoogle(entrada: {
  codigo: string
  origem: string
}): Promise<{ refreshToken: string; email: string | null; escopos: string }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: entrada.codigo,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${entrada.origem}${RETORNO_DO_GOOGLE_AGENDA}`,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })
  const corpo = (await r.json().catch(() => null)) as {
    refresh_token?: unknown
    id_token?: unknown
    scope?: unknown
    error_description?: unknown
  } | null
  if (!r.ok || typeof corpo?.refresh_token !== 'string') {
    const detalhe = typeof corpo?.error_description === 'string' ? corpo.error_description : `HTTP ${r.status}`
    throw new Error(`o Google recusou o código: ${detalhe}`)
  }
  return {
    refreshToken: corpo.refresh_token,
    email: emailDoIdToken(corpo.id_token),
    escopos: typeof corpo.scope === 'string' ? corpo.scope : '',
  }
}

/**
 * O e-mail do `id_token`. Sem conferir a assinatura de propósito: o token
 * veio agora, direto do endpoint do Google por TLS, e o e-mail é só para a
 * tela dizer qual agenda está ligada.
 */
function emailDoIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null
  try {
    const carga = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: unknown }
    return typeof carga.email === 'string' ? carga.email : null
  } catch {
    return null
  }
}

/** Token de acesso por refresh token, guardado na instância até perto de vencer. */
const CACHE = new Map<string, { token: string; venceEm: number }>()

export async function tokenDeAcessoDoGoogle(refreshToken: string): Promise<ResultadoDaAgenda<string>> {
  if (!refreshToken) return { ok: false, motivo: 'a agenda do Google não tem autorização; conecte de novo' }
  const guardado = CACHE.get(refreshToken)
  if (guardado && guardado.venceEm > Date.now() + 60_000) return { ok: true, valor: guardado.token }

  let r: Response
  try {
    r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return { ok: false, motivo: 'o Google não respondeu' }
  }
  const corpo = (await r.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown; error?: unknown } | null
  if (!r.ok || typeof corpo?.access_token !== 'string') {
    return corpo?.error === 'invalid_grant'
      ? { ok: false, motivo: 'o Google revogou o acesso à agenda; conecte de novo' }
      : { ok: false, motivo: `o Google recusou a renovação (HTTP ${r.status})` }
  }
  if (CACHE.size > 200) CACHE.clear()
  const segundos = typeof corpo.expires_in === 'number' ? corpo.expires_in : 3600
  CACHE.set(refreshToken, { token: corpo.access_token, venceEm: Date.now() + segundos * 1000 })
  return { ok: true, valor: corpo.access_token }
}
