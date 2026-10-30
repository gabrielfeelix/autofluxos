import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import {
  centavosDeReais,
  type CobrancaCriada,
  type GatewayDePagamento,
  type PedidoDeCobranca,
  type SituacaoDoPagamento,
} from './pagamento'

/**
 * O Mercado Pago: conectar a conta do dono por login (OAuth) e falar com a API
 * em nome dele (docs/PLANO-COBRANCA-CAMADA-1.md).
 *
 * **O dinheiro nunca passa por nós.** Tudo aqui age com o token do dono, na
 * conta do dono: a cobrança é dele, o Pix cai para ele, e o Dialogon não
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

// ---------------------------------------------------------------------------
// Etapa B: cobrar, ler e cancelar (escrita contra a documentação; o teste com
// dinheiro de verdade espera a aplicação do Mercado Pago existir)
// ---------------------------------------------------------------------------

/**
 * O Mercado Pago exige e-mail de quem paga no Pix. Contato de WhatsApp quase
 * nunca tem; este endereço não recebe nada e só preenche o campo. Quem paga
 * pelo link digita o próprio e-mail no checkout.
 */
const EMAIL_SEM_EMAIL = 'pagador@dialogon.com.br'

async function chamarComToken<T>(
  token: string,
  metodo: 'GET' | 'POST' | 'PUT',
  caminho: string,
  corpo?: unknown,
  idempotencia?: string,
): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(idempotencia ? { 'X-Idempotency-Key': idempotencia } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // O corpo do erro não sobe: pode trazer o e-mail ou o documento de quem paga.
  if (!resposta.ok) throw new Error(`o Mercado Pago recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`)
  return (await resposta.json()) as T
}

const pagamentoSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
  transaction_amount: z.number(),
  external_reference: z.string().nullish(),
  date_approved: z.string().nullish(),
  point_of_interaction: z
    .object({
      transaction_data: z.object({ qr_code: z.string().nullish(), ticket_url: z.string().nullish() }).partial().nullish(),
    })
    .nullish(),
})

const preferenciaSchema = z.object({ id: z.string().min(1), init_point: z.string().min(1) })

export function situacaoDoMercadoPago(status: string): SituacaoDoPagamento {
  if (status === 'approved') return 'paga'
  if (status === 'refunded' || status === 'charged_back') return 'estornada'
  // `rejected` é um cartão recusado no link, e a pessoa pode tentar de novo;
  // `cancelled` é o Pix que venceu. Nenhum dos dois cancela a cobrança.
  if (status === 'cancelled') return 'cancelada'
  return 'pendente'
}

/** `2026-10-23T18:00:00.000-03:00`: o formato que o `date_of_expiration` aceita. */
export function dataDoMercadoPago(quando: Date): string {
  const local = new Date(quando.getTime() - 3 * 3_600_000)
  return `${local.toISOString().slice(0, 23)}-03:00`
}

export const mercadoPago: GatewayDePagamento = {
  /**
   * Duas chamadas: o Pix (copia e cola, que vai na conversa) e a preferência
   * do Checkout Pro (o link, com cartão e boleto). A mesma `referencia` nas
   * duas: o aviso de pagamento de qualquer uma acha a mesma cobrança.
   */
  async criarCobranca(acesso, pedido: PedidoDeCobranca): Promise<CobrancaCriada> {
    const [primeiroNome, ...resto] = pedido.pagador.nome.trim().split(/\s+/)
    const documento = pedido.pagador.documento
    const pix = pagamentoSchema.parse(
      await chamarComToken(
        acesso.token,
        'POST',
        '/v1/payments',
        {
          transaction_amount: pedido.valorCentavos / 100,
          description: pedido.descricao.slice(0, 200),
          payment_method_id: 'pix',
          date_of_expiration: dataDoMercadoPago(pedido.venceEm),
          external_reference: pedido.referencia,
          payer: {
            email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
            first_name: primeiroNome || 'Cliente',
            ...(resto.length ? { last_name: resto.join(' ') } : {}),
            ...(documento ? { identification: { type: documento.length === 14 ? 'CNPJ' : 'CPF', number: documento } } : {}),
          },
        },
        `pix:${pedido.referencia}`,
      ),
    )

    // O link é a alternativa, não o principal: sem ele a cobrança sai só no Pix.
    const preferencia = preferenciaSchema.safeParse(
      await chamarComToken(
        acesso.token,
        'POST',
        '/checkout/preferences',
        {
          items: [{ title: pedido.descricao.slice(0, 200), quantity: 1, unit_price: pedido.valorCentavos / 100, currency_id: 'BRL' }],
          external_reference: pedido.referencia,
          expires: true,
          expiration_date_to: dataDoMercadoPago(pedido.venceEm),
        },
        `link:${pedido.referencia}`,
      ).catch(() => null),
    )

    return {
      pagamentoId: pix.id,
      preferenciaId: preferencia.success ? preferencia.data.id : null,
      pixCopiaCola: pix.point_of_interaction?.transaction_data?.qr_code ?? null,
      link: preferencia.success ? preferencia.data.init_point : (pix.point_of_interaction?.transaction_data?.ticket_url ?? null),
    }
  },

  async lerPagamento(acesso, pagamentoId) {
    const p = pagamentoSchema.parse(await chamarComToken(acesso.token, 'GET', `/v1/payments/${encodeURIComponent(pagamentoId)}`))
    const situacao = situacaoDoMercadoPago(p.status)
    return {
      pagamentoId: p.id,
      referencia: p.external_reference ?? null,
      situacao,
      valorCentavos: centavosDeReais(p.transaction_amount),
      pagaEm: situacao === 'paga' ? (p.date_approved ? new Date(p.date_approved) : new Date()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamarComToken(acesso.token, 'PUT', `/v1/payments/${encodeURIComponent(pagamentoId)}`, { status: 'cancelled' })
  },
}

/**
 * Confere o `x-signature` do aviso (Webhooks configurados na aplicação, com a
 * "assinatura secreta" de lá em `MERCADO_PAGO_WEBHOOK_SECRET`).
 *
 * O manifesto é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, com o id em
 * minúsculas, e a assinatura é HMAC-SHA256 dele em hexadecimal. Falha fechada
 * sem o segredo no ambiente: `undefined` contra `undefined` não pode abrir.
 */
export function assinaturaDoAvisoValida(entrada: {
  assinatura: string | null
  requisicao: string | null
  dataId: string | null
}): boolean {
  const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
  if (!segredo || !entrada.assinatura) return false
  const partes = new Map(
    entrada.assinatura.split(',').map((parte) => {
      const [chave, ...valor] = parte.split('=')
      return [chave!.trim(), valor.join('=').trim()] as const
    }),
  )
  const ts = partes.get('ts')
  const v1 = partes.get('v1')
  if (!ts || !v1) return false
  let manifesto = ''
  if (entrada.dataId) manifesto += `id:${entrada.dataId.toLowerCase()};`
  if (entrada.requisicao) manifesto += `request-id:${entrada.requisicao};`
  manifesto += `ts:${ts};`
  return iguais(v1, createHmac('sha256', segredo).update(manifesto).digest('hex'))
}

const avisoSchema = z.object({
  type: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).optional(),
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
})

/**
 * De quem é e qual pagamento. O `user_id` é a conta do dono (a aplicação
 * recebe o aviso de todas as contas conectadas a ela). O resto do corpo não é
 * lido: o pagamento é relido na API com o token do dono.
 */
export function pagamentoDoAviso(corpo: unknown): { contaId: string; pagamentoId: string } | null {
  const lido = avisoSchema.safeParse(corpo)
  if (!lido.success || lido.data.type !== 'payment' || !lido.data.data || !lido.data.user_id) return null
  if (!/^[0-9]{1,20}$/.test(lido.data.data.id) || !/^[0-9]{1,20}$/.test(lido.data.user_id)) return null
  return { contaId: lido.data.user_id, pagamentoId: lido.data.data.id }
}
