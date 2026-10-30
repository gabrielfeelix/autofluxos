import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import type { Ambiente, CobrancaCriada, GatewayDePagamento, PagamentoLido, PedidoDeCobranca, SituacaoDoPagamento } from './pagamento'

/**
 * O PagBank pelo Connect: o dono autoriza por login (OAuth), e a cobrança sai
 * como Pix copia e cola na conversa (`POST /orders` com `qr_codes`).
 *
 * Documentação: developer.pagbank.com.br/docs/connect-authorization,
 * /reference/obter-access-token, /reference/renovar-access-token,
 * /reference/criar-pedido, e o repositório oficial
 * github.com/pbintegracoes/pagbank-agent-skills (docs/04 e docs/07).
 *
 * **O dinheiro nunca passa por nós.** O pedido nasce com o token do dono, na
 * conta do dono.
 *
 * Quatro coisas do PagBank que mudam o código:
 *
 * 1. **A troca do `code` leva três credenciais**: `X_CLIENT_ID` e
 *    `X_CLIENT_SECRET` da aplicação, e no `Authorization` o token da conta da
 *    4YU que criou a aplicação (`PAGBANK_TOKEN`). Sem os três, a tela diz "em
 *    liberação" (`pagbankConfigurado`).
 * 2. **O `state` só aceita letra e número**, até 128. O bilhete assinado tem
 *    ponto, hífen e sublinhado: `stateDoPagBank` o reescreve sem perder nada.
 * 3. **O endereço do aviso tem no máximo 100 caracteres.** O id da organização
 *    e o segredo vão em base64url (`enderecoDoAviso`); passou de 100, o pedido
 *    sai sem aviso e quem confirma é o relógio do vencimento.
 * 4. **O `x-authenticity-token` do aviso tem relatos de falha** e depende de
 *    um token da conta que não temos. Não é conferido: o segredo do endereço
 *    barra quem não sabe o endereço, e o pedido é relido na API com o token do
 *    dono antes de a cobrança mudar.
 *
 * Sandbox: `PAGBANK_SANDBOX=1` troca os dois endereços, e a conexão nasce com
 * `ambiente = 'teste'`; o token de sandbox só funciona no endereço de sandbox,
 * e é pelo ambiente da conexão que cada chamada escolhe o seu.
 */

const PRAZO_MS = 10_000
const ESCOPOS = ['payments.read', 'payments.create', 'checkout.create', 'accounts.read']

const ENDERECOS: Record<Ambiente, { api: string; autorizar: string }> = {
  producao: { api: 'https://api.pagseguro.com', autorizar: 'https://connect.pagbank.com.br/oauth2/authorize' },
  teste: { api: 'https://sandbox.api.pagseguro.com', autorizar: 'https://connect.sandbox.pagbank.com.br/oauth2/authorize' },
}

/** O ambiente em que a 4YU conecta contas novas. */
export function ambienteDoPagBank(): Ambiente {
  return process.env.PAGBANK_SANDBOX?.trim() === '1' ? 'teste' : 'producao'
}

function credenciais(): { clienteId: string; segredo: string; token: string } {
  const clienteId = process.env.PAGBANK_CLIENT_ID?.trim()
  const segredo = process.env.PAGBANK_CLIENT_SECRET?.trim()
  const token = process.env.PAGBANK_TOKEN?.trim()
  if (!clienteId || !segredo || !token) throw new Error('falta PAGBANK_CLIENT_ID, PAGBANK_CLIENT_SECRET ou PAGBANK_TOKEN')
  return { clienteId, segredo, token }
}

export function pagbankConfigurado(): boolean {
  return Boolean(process.env.PAGBANK_CLIENT_ID?.trim() && process.env.PAGBANK_CLIENT_SECRET?.trim() && process.env.PAGBANK_TOKEN?.trim())
}

/** Tem de bater byte a byte com o `redirect_uri` da aplicação no PagBank: uma aplicação por endereço. */
export function retornoDoPagBank(origem: string): string {
  return `${origem}/api/pagamentos/pagbank/retorno`
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

const UUID = /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i

/**
 * `<uuid>.<ms>.<assinatura base64url>` vira `<uuid sem hífen>x<ms>x<assinatura em hex>`:
 * 32 + 1 + 13 + 1 + 64 = 111 caracteres, só letra e número. `estadoDoPagBank`
 * desfaz, e quem confere a assinatura e o cookie continua sendo `concluirConexao`.
 */
export function stateDoPagBank(estado: string): string {
  const [cliente, ms, assinatura] = estado.split('.')
  if (!cliente || !ms || !assinatura) throw new Error('bilhete de conexão estranho')
  return `${cliente.replaceAll('-', '')}x${ms}x${Buffer.from(assinatura, 'base64url').toString('hex')}`
}

export function estadoDoPagBank(state: string | null): string | null {
  const partes = state?.match(/^([0-9a-f]{32})x([0-9]{1,15})x([0-9a-f]{2,128})$/i)
  if (!partes) return null
  const cliente = partes[1]!.replace(UUID, '$1-$2-$3-$4-$5').toLowerCase()
  return `${cliente}.${partes[2]}.${Buffer.from(partes[3]!, 'hex').toString('base64url')}`
}

/** Para onde o dono vai autorizar. */
export function urlDeAutorizacao(entrada: { origem: string; estado: string }): string {
  const url = new URL(ENDERECOS[ambienteDoPagBank()].autorizar)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', credenciais().clienteId)
  url.searchParams.set('redirect_uri', retornoDoPagBank(entrada.origem))
  // O PagBank separa escopos com `+`, que é como o espaço sai no `searchParams`.
  url.searchParams.set('scope', ESCOPOS.join(' '))
  url.searchParams.set('state', stateDoPagBank(entrada.estado))
  return url.toString()
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  // A referência diz texto; o exemplo é número. Lido, nunca suposto.
  expires_in: z.union([z.number(), z.string()]).transform(Number).optional(),
  account_id: z.string().min(1),
})

export type TokenDoPagBank = {
  token: string
  renovacao: string | null
  expiraEm: Date | null
  contaId: string
  ambiente: Ambiente
}

async function pedirToken(caminho: '/oauth2/token' | '/oauth2/refresh', corpo: Record<string, string>, ambiente: Ambiente) {
  const { clienteId, segredo, token } = credenciais()
  const resposta = await fetch(`${ENDERECOS[ambiente].api}${caminho}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      X_CLIENT_ID: clienteId,
      X_CLIENT_SECRET: segredo,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // O corpo de erro não vai para a mensagem: pode ecoar o segredo enviado.
  if (!resposta.ok) throw new Error(`o PagBank recusou o pedido de token (${resposta.status})`)
  const lido = tokenSchema.safeParse(await resposta.json().catch(() => null))
  if (!lido.success) throw new Error('o PagBank respondeu sem token')
  if (!/^ACCO_[0-9A-Za-z-]{1,60}$/.test(lido.data.account_id)) throw new Error('o PagBank respondeu um id de conta estranho')
  const segundos = lido.data.expires_in
  return {
    token: lido.data.access_token,
    renovacao: lido.data.refresh_token ?? null,
    expiraEm: segundos && Number.isFinite(segundos) && segundos > 0 ? new Date(Date.now() + segundos * 1_000) : null,
    contaId: lido.data.account_id,
    ambiente,
  }
}

/** Troca o `code` (dez minutos, uso único) pelo token do dono. */
export function trocarCodigo(entrada: { codigo: string; origem: string }): Promise<TokenDoPagBank> {
  return pedirToken(
    '/oauth2/token',
    { grant_type: 'authorization_code', code: entrada.codigo, redirect_uri: retornoDoPagBank(entrada.origem) },
    ambienteDoPagBank(),
  )
}

/**
 * Um token novo a partir do de renovação. O PagBank gera **outro** refresh
 * token e invalida o anterior: quem chama tem de guardar os dois.
 */
export function renovarToken(renovacao: string, ambiente: Ambiente): Promise<TokenDoPagBank> {
  return pedirToken('/oauth2/refresh', { grant_type: 'refresh_token', refresh_token: renovacao }, ambiente)
}

const contaSchema = z.object({
  email: z.string().optional(),
  person: z.object({ name: z.string().optional() }).partial().optional(),
  company: z.object({ name: z.string().optional() }).partial().optional(),
})

/** Quem é o dono do token, para a tela dizer "conectado como". Sem resposta, a tela mostra o id. */
export async function apelidoDaConta(token: TokenDoPagBank): Promise<string | null> {
  try {
    const resposta = await fetch(`${ENDERECOS[token.ambiente].api}/accounts/${encodeURIComponent(token.contaId)}`, {
      headers: { Authorization: `Bearer ${token.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(PRAZO_MS),
      cache: 'no-store',
    })
    if (!resposta.ok) return null
    const lido = contaSchema.safeParse(await resposta.json().catch(() => null))
    if (!lido.success) return null
    return lido.data.email ?? lido.data.company?.name ?? lido.data.person?.name ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// O aviso
// ---------------------------------------------------------------------------

/** 22 caracteres de base64url, 132 bits: o que cabe no endereço de 100. */
export function segredoDoAviso(clienteId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o aviso do PagBank')
  return createHmac('sha256', `pagbank:${chave}`).update(clienteId).digest('base64url').slice(0, 22)
}

export function avisoAutentico(clienteId: string, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, segredoDoAviso(clienteId))
  } catch {
    return false
  }
}

/** O id da organização em 22 caracteres. `clienteDoEndereco` desfaz. */
export function enderecoDoCliente(clienteId: string): string {
  return Buffer.from(clienteId.replaceAll('-', ''), 'hex').toString('base64url')
}

export function clienteDoEndereco(curto: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(curto)) return null
  const hex = Buffer.from(curto, 'base64url').toString('hex')
  return hex.length === 32 ? hex.replace(UUID, '$1-$2-$3-$4-$5') : null
}

const TETO_DO_ENDERECO = 100

/** `https://dialogon.com.br/api/webhook/pagbank/<22>?t=<22>`: 97 caracteres. */
export function enderecoDoAviso(clienteId: string): string | null {
  const base = process.env.VERCEL_ENV === 'production' ? 'https://dialogon.com.br' : process.env.BETTER_AUTH_URL
  if (!base) return null
  const endereco = `${base.replace(/\/$/, '')}/api/webhook/pagbank/${enderecoDoCliente(clienteId)}?t=${segredoDoAviso(clienteId)}`
  return endereco.length <= TETO_DO_ENDERECO ? endereco : null
}

const ID_DO_PEDIDO = /^ORDE_[0-9A-Fa-f-]{36}$/

/** O corpo do aviso é o pedido inteiro. Só o id sai dele: o resto é relido na API. */
export function pedidoDoAviso(corpo: unknown): string | null {
  const id = corpo && typeof corpo === 'object' ? (corpo as { id?: unknown }).id : null
  return typeof id === 'string' && ID_DO_PEDIDO.test(id) ? id : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

/**
 * O PagBank pede e-mail de quem paga, e contato de WhatsApp quase nunca tem.
 * Este endereço não recebe nada e só preenche o campo, como no Mercado Pago.
 */
const EMAIL_SEM_EMAIL = 'pagador@dialogon.com.br'

async function chamar<T>(
  acesso: { token: string; ambiente: Ambiente },
  metodo: 'GET' | 'POST',
  caminho: string,
  corpo?: unknown,
  idempotencia?: string,
) {
  const resposta = await fetch(`${ENDERECOS[acesso.ambiente].api}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${acesso.token}`,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(idempotencia ? { 'x-idempotency-key': idempotencia } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // Só o status: a resposta de erro pode trazer o CPF de quem paga.
  if (!resposta.ok) throw new Error(`o PagBank recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`)
  return (await resposta.json()) as T
}

/** `5544999998888` vira `{ country: '55', area: '44', number: '999998888' }`. Só número do Brasil. */
export function telefoneDoPagBank(telefone: string | null): { country: string; area: string; number: string; type: 'MOBILE' } | null {
  const partes = telefone?.match(/^55(\d{2})(\d{8,9})$/)
  return partes ? { country: '55', area: partes[1]!, number: partes[2]!, type: 'MOBILE' } : null
}

/** `2026-10-23T18:00:00-03:00`: o relógio do Brasil, com o fuso escrito. */
export function dataDoPagBank(quando: Date): string {
  const local = new Date(quando.getTime() - 3 * 3_600_000)
  return `${local.toISOString().slice(0, 19)}-03:00`
}

const pedidoSchema = z.object({
  id: z.string().regex(ID_DO_PEDIDO),
  reference_id: z.string().nullish(),
  qr_codes: z.array(z.object({ text: z.string().nullish() })).nullish(),
  charges: z
    .array(
      z.object({
        status: z.string(),
        paid_at: z.string().nullish(),
        amount: z.object({
          value: z.number(),
          summary: z.object({ paid: z.number().optional(), refunded: z.number().optional() }).partial().nullish(),
        }),
      }),
    )
    .nullish(),
})

type Pedido = z.infer<typeof pedidoSchema>

/**
 * O estado do pedido na nossa língua, pelas cobranças (`charges`) dele. Pix
 * ainda não pago não tem cobrança nenhuma: é pendente. Estornado, a cobrança
 * fica `CANCELED` com valor devolvido; `DECLINED` é um pagamento que não
 * passou, e a pessoa ainda pode pagar o QR.
 */
export function situacaoDoPedido(pedido: Pick<Pedido, 'charges'>): {
  situacao: SituacaoDoPagamento
  valorCentavos: number
  pagaEm: Date | null
} {
  const cobrancas = pedido.charges ?? []
  const paga = cobrancas.find((c) => c.status === 'PAID')
  if (paga) {
    return {
      situacao: 'paga',
      valorCentavos: paga.amount.summary?.paid ?? paga.amount.value,
      pagaEm: paga.paid_at ? new Date(paga.paid_at) : new Date(),
    }
  }
  const estornada = cobrancas.find((c) => c.status === 'CANCELED' && (c.amount.summary?.refunded ?? 0) > 0)
  if (estornada) return { situacao: 'estornada', valorCentavos: estornada.amount.value, pagaEm: null }
  return { situacao: 'pendente', valorCentavos: 0, pagaEm: null }
}

export const pagbank: GatewayDePagamento = {
  /** Um pedido com um QR Pix, que vence junto com a cobrança. O PagBank não tem link para Pix por pedido. */
  async criarCobranca(acesso, pedido: PedidoDeCobranca): Promise<CobrancaCriada> {
    if (!pedido.pagador.documento) throw new Error('o PagBank exige o CPF ou CNPJ de quem paga')
    const aviso = pedido.clienteId ? enderecoDoAviso(pedido.clienteId) : null
    const telefone = telefoneDoPagBank(pedido.pagador.telefone)
    const criado = pedidoSchema.extend({ qr_codes: z.array(z.object({ text: z.string().min(1) })).min(1) }).parse(
      await chamar(
        acesso,
        'POST',
        '/orders',
        {
          reference_id: pedido.referencia,
          customer: {
            name: pedido.pagador.nome.slice(0, 120),
            email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
            tax_id: pedido.pagador.documento,
            ...(telefone ? { phones: [telefone] } : {}),
          },
          items: [
            { reference_id: pedido.referencia, name: pedido.descricao.slice(0, 100), quantity: 1, unit_amount: pedido.valorCentavos },
          ],
          qr_codes: [{ amount: { value: pedido.valorCentavos }, expiration_date: dataDoPagBank(pedido.venceEm) }],
          // Sem endereço (fora de produção, ou passou de 100), cobra igual; o relógio confirma.
          ...(aviso ? { notification_urls: [aviso] } : {}),
        },
        pedido.referencia,
      ),
    )
    return { pagamentoId: criado.id, preferenciaId: null, pixCopiaCola: criado.qr_codes[0]!.text, link: null }
  },

  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    if (!ID_DO_PEDIDO.test(pagamentoId)) throw new Error('id de pedido do PagBank estranho')
    const lido = pedidoSchema.parse(await chamar(acesso, 'GET', `/orders/${encodeURIComponent(pagamentoId)}`))
    return { pagamentoId: lido.id, referencia: lido.reference_id ?? null, ...situacaoDoPedido(lido) }
  },

  /**
   * Não há como cancelar um QR de pedido ainda não pago: ele vence sozinho no
   * `expiration_date`, que é o vencimento da cobrança. Cancelar `charge` é
   * estorno, e estorno não é decisão do relógio.
   */
  async cancelarPagamento() {},
}
