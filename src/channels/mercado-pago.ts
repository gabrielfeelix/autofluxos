import 'server-only'
import { z } from 'zod'

/**
 * O Mercado Pago: conectar a conta do dono por login (OAuth) e falar com a API
 * em nome dele (docs/PLANO-COBRANCA-CAMADA-1.md).
 *
 * **O dinheiro nunca passa por nós.** Tudo aqui age com o token do dono, na
 * conta do dono: a cobrança é dele, o Pix cai para ele, e o AutoFluxos não
 * cobra porcentagem (Resolução BCB 494/2025, ver MERCADO-COBRANCA-NO-CHAT.md).
 *
 * `MERCADO_PAGO_CLIENT_ID` e `MERCADO_PAGO_CLIENT_SECRET` vêm da aplicação
 * criada no Mercado Pago Developers com a conta da 4YU. Sem os dois a conexão
 * não é oferecida: `mercadoPagoConfigurado()` é o que a tela pergunta.
 *
 * A URL de retorno cadastrada na aplicação precisa ser, byte a byte,
 * `<origem>/api/pagamentos/mercado-pago/retorno`, uma por ambiente.
 */

const AUTORIZAR = 'https://auth.mercadopago.com.br/authorization'
const API = 'https://api.mercadopago.com'
const PRAZO_MS = 10_000

function credenciais(): { clienteId: string; segredo: string } {
  const clienteId = process.env.MERCADO_PAGO_CLIENT_ID?.trim()
  const segredo = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim()
  if (!clienteId || !segredo) throw new Error('falta MERCADO_PAGO_CLIENT_ID ou MERCADO_PAGO_CLIENT_SECRET')
  return { clienteId, segredo }
}

export function mercadoPagoConfigurado(): boolean {
  return Boolean(process.env.MERCADO_PAGO_CLIENT_ID?.trim() && process.env.MERCADO_PAGO_CLIENT_SECRET?.trim())
}

export function retornoDoMercadoPago(origem: string): string {
  return `${origem}/api/pagamentos/mercado-pago/retorno`
}

/** Para onde o dono vai autorizar. O `state` assinado volta junto e diz qual conta começou. */
export function urlDeAutorizacao(entrada: { origem: string; state: string }): string {
  const url = new URL(AUTORIZAR)
  url.searchParams.set('client_id', credenciais().clienteId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('state', entrada.state)
  url.searchParams.set('redirect_uri', retornoDoMercadoPago(entrada.origem))
  return url.toString()
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  // Segundos. 15552000 (180 dias) hoje; lido, nunca suposto.
  expires_in: z.number().int().positive().optional(),
  // Número na resposta do OAuth; aceita texto pelo mesmo motivo da Nuvemshop.
  user_id: z.union([z.string(), z.number()]).transform(String),
  live_mode: z.boolean().optional(),
})

export type TokenDoMercadoPago = {
  token: string
  renovacao: string | null
  expiraEm: Date | null
  contaId: string
  aoVivo: boolean
}

async function pedirToken(corpo: Record<string, string>): Promise<TokenDoMercadoPago> {
  const { clienteId, segredo } = credenciais()
  const resposta = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clienteId, client_secret: segredo, ...corpo }),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // O corpo de erro não vai para a mensagem: pode ecoar o segredo enviado.
  if (!resposta.ok) throw new Error(`o Mercado Pago recusou o pedido de token (${resposta.status})`)
  const lido = tokenSchema.safeParse(await resposta.json().catch(() => null))
  if (!lido.success) throw new Error('o Mercado Pago respondeu sem token')
  if (!/^[0-9]{1,20}$/.test(lido.data.user_id)) throw new Error('o Mercado Pago respondeu um id de conta estranho')
  return {
    token: lido.data.access_token,
    renovacao: lido.data.refresh_token ?? null,
    expiraEm: lido.data.expires_in ? new Date(Date.now() + lido.data.expires_in * 1_000) : null,
    contaId: lido.data.user_id,
    aoVivo: lido.data.live_mode ?? true,
  }
}

/** Troca o `code` da volta do login pelo token do dono. */
export function trocarCodigo(entrada: { codigo: string; origem: string }): Promise<TokenDoMercadoPago> {
  return pedirToken({
    grant_type: 'authorization_code',
    code: entrada.codigo,
    redirect_uri: retornoDoMercadoPago(entrada.origem),
  })
}

/**
 * Um token novo a partir do de renovação. O Mercado Pago devolve **outro**
 * refresh token junto, e o antigo deixa de valer: quem chama tem de guardar
 * os dois.
 */
export function renovarToken(renovacao: string): Promise<TokenDoMercadoPago> {
  return pedirToken({ grant_type: 'refresh_token', refresh_token: renovacao })
}

const contaSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  nickname: z.string().optional(),
  email: z.string().optional(),
})

/** Quem é o dono do token, para a tela dizer "conectado como". */
export async function lerConta(token: string): Promise<{ id: string; apelido: string | null }> {
  const resposta = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new Error(`o Mercado Pago não disse de quem é a conta (${resposta.status})`)
  const lido = contaSchema.safeParse(await resposta.json().catch(() => null))
  if (!lido.success) throw new Error('o Mercado Pago respondeu uma conta estranha')
  return { id: lido.data.id, apelido: lido.data.email ?? lido.data.nickname ?? null }
}
