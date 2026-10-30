import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import { EMAIL_SEM_EMAIL, type AcessoAoGateway, type GatewayDePagamento, type PagamentoLido, type PedidoDeCobranca } from './pagamento'

/**
 * O Stripe pelo Connect Standard (docs/gateways/pesquisa-stripe-e-outros.md, seção 1).
 *
 * - **Conectar**: OAuth (`connect.stripe.com/oauth/authorize`). O token que a
 *   resposta traz está obsoleto: o que se guarda é a conta do dono (`acct_`),
 *   e cada chamada vai com **a chave secreta da 4YU** (`STRIPE_SECRET_KEY`) e o
 *   cabeçalho `Stripe-Account`. Essa chave vale para todas as contas
 *   conectadas: é o segredo mais forte deste arquivo.
 * - **Cobrar**: duas coisas, como no Mercado Pago. O Pix é um PaymentIntent
 *   confirmado aqui no servidor; o link é uma Checkout Session (cartão, boleto
 *   e Pix, conforme o que o dono ligou no Stripe dele). Pix recusado (conta sem
 *   Pix, ou ramo que o Stripe proíbe, como clínica e farmácia) não impede o
 *   link: a cobrança sai só com ele.
 * - **Aviso**: um endpoint só, da plataforma (`api/webhook/stripe`), assinado
 *   com `STRIPE_WEBHOOK_SECRET`; o evento diz a conta (`account`), e o
 *   PaymentIntent ou a sessão é relido com a chave da 4YU.
 * - Ambiente pelo prefixo da chave: `sk_test_` conecta contas de teste.
 */

const API = 'https://api.stripe.com/v1'
const CONECTAR = 'https://connect.stripe.com/oauth'
const PRAZO_MS = 10_000

function chaveDaPlataforma(): string {
  const chave = process.env.STRIPE_SECRET_KEY?.trim()
  if (!chave) throw new Error('falta STRIPE_SECRET_KEY')
  return chave
}

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_CONNECT_CLIENT_ID?.trim())
}

export function ambienteDoStripe() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_test_') ? ('teste' as const) : ('producao' as const)
}

export function retornoDoStripe(origem: string): string {
  return `${origem}/api/pagamentos/stripe/retorno`
}

/** `{ a: { b: 1 } }` vira `a[b]=1`, como a API do Stripe lê. */
export function formulario(dados: Record<string, unknown>, prefixo = '', saida = new URLSearchParams()): URLSearchParams {
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor === undefined || valor === null) continue
    const nome = prefixo ? `${prefixo}[${chave}]` : chave
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item !== null && typeof item === 'object') formulario(item as Record<string, unknown>, `${nome}[${i}]`, saida)
        else saida.append(`${nome}[${i}]`, String(item))
      })
    } else if (typeof valor === 'object') {
      formulario(valor as Record<string, unknown>, nome, saida)
    } else {
      saida.append(nome, String(valor))
    }
  }
  return saida
}

async function chamar<T>(
  conta: string | null,
  metodo: 'GET' | 'POST',
  caminho: string,
  dados?: Record<string, unknown>,
  idempotencia?: string,
): Promise<T> {
  const resposta = await fetch(`${caminho.startsWith('https://') ? '' : API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${chaveDaPlataforma()}`,
      ...(conta ? { 'Stripe-Account': conta } : {}),
      ...(dados ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
    },
    body: dados ? formulario(dados).toString() : undefined,
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // Só o status: o corpo de erro pode trazer o e-mail ou o CPF de quem paga.
  if (!resposta.ok) throw new Error(`o Stripe recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`)
  return (await resposta.json()) as T
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

export function urlDeAutorizacao(entrada: { origem: string; estado: string }): string {
  const clienteId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim()
  if (!clienteId) throw new Error('falta STRIPE_CONNECT_CLIENT_ID')
  const url = new URL(`${CONECTAR}/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clienteId)
  url.searchParams.set('scope', 'read_write')
  url.searchParams.set('state', entrada.estado)
  url.searchParams.set('redirect_uri', retornoDoStripe(entrada.origem))
  return url.toString()
}

const CONTA = /^acct_[A-Za-z0-9]{8,40}$/

/** Troca o `code` (cinco minutos, uso único) pela conta do dono. */
export async function trocarCodigo(codigo: string): Promise<{ conta: string; aoVivo: boolean }> {
  const lido = z
    .object({ stripe_user_id: z.string().regex(CONTA), livemode: z.boolean().optional() })
    .parse(await chamar(null, 'POST', `${CONECTAR}/token`, { grant_type: 'authorization_code', code: codigo }))
  return { conta: lido.stripe_user_id, aoVivo: lido.livemode ?? true }
}

/** Quem é o dono da conta, para a tela dizer "conectado como". */
export async function apelidoDaConta(conta: string): Promise<string | null> {
  try {
    const lido = z
      .object({
        email: z.string().nullish(),
        business_profile: z.object({ name: z.string().nullish() }).partial().nullish(),
        settings: z
          .object({ dashboard: z.object({ display_name: z.string().nullish() }).partial().nullish() })
          .partial()
          .nullish(),
      })
      .parse(await chamar(conta, 'GET', '/account'))
    return lido.business_profile?.name ?? lido.settings?.dashboard?.display_name ?? lido.email ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const TOLERANCIA_S = 300

/**
 * `Stripe-Signature: t=<s>,v1=<hex>`: HMAC-SHA256 de `<t>.<corpo bruto>` com
 * o segredo do endpoint. Fora da janela de cinco minutos, recusa: um aviso
 * capturado não serve de novo depois. Falha fechada sem o segredo.
 */
export function assinaturaValida(corpo: string, cabecalho: string | null, agora = Date.now()): boolean {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!segredo || !cabecalho) return false
  const partes = cabecalho.split(',').map((p) => p.split('=') as [string, string])
  const t = partes.find(([k]) => k === 't')?.[1]
  const assinaturas = partes.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || !/^\d+$/.test(t) || assinaturas.length === 0) return false
  if (Math.abs(agora / 1_000 - Number(t)) > TOLERANCIA_S) return false
  const esperada = createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex')
  return assinaturas.some((v) => iguais(v, esperada))
}

export type EventoDoStripe = { conta: string; tipo: string; objetoId: string | null }

/** Só a conta, o tipo e o id do objeto. O resto é relido. */
export function eventoDoAviso(corpo: unknown): EventoDoStripe | null {
  const lido = z
    .object({ type: z.string(), account: z.string().regex(CONTA), data: z.object({ object: z.object({ id: z.string() }).partial() }) })
    .safeParse(corpo)
  if (!lido.success) return null
  const id = lido.data.data.object.id ?? null
  const util = id && /^(pi|cs)_[A-Za-z0-9_]{8,200}$/.test(id) ? id : null
  return { conta: lido.data.account, tipo: lido.data.type, objetoId: util }
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

const intencaoSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number(),
  amount_received: z.number().nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
  next_action: z
    .object({ pix_display_qr_code: z.object({ data: z.string().nullish() }).partial().nullish() })
    .partial()
    .nullish(),
  latest_charge: z
    .union([
      z.string(),
      z.object({ created: z.number().nullish(), refunded: z.boolean().nullish(), amount_refunded: z.number().nullish() }),
    ])
    .nullish(),
})

const sessaoSchema = z.object({
  id: z.string(),
  url: z.string().nullish(),
  status: z.string().nullish(),
  payment_status: z.string().nullish(),
  amount_total: z.number().nullish(),
  client_reference_id: z.string().nullish(),
  created: z.number().nullish(),
})

/** O Pix do Stripe vale de 60 s a 14 dias; o link, de 30 minutos a 24 horas. */
function entre(segundos: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, segundos))
}

async function criarPix(conta: string, pedido: PedidoDeCobranca): Promise<z.infer<typeof intencaoSchema> | null> {
  if (!pedido.pagador.documento) return null
  const agora = Math.floor(Date.now() / 1_000)
  try {
    return intencaoSchema.parse(
      await chamar(
        conta,
        'POST',
        '/payment_intents',
        {
          amount: pedido.valorCentavos,
          currency: 'brl',
          description: pedido.descricao.slice(0, 200),
          payment_method_types: ['pix'],
          payment_method_data: {
            type: 'pix',
            billing_details: {
              name: pedido.pagador.nome.slice(0, 100),
              email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
              tax_id: pedido.pagador.documento,
            },
          },
          payment_method_options: {
            pix: { expires_at: agora + entre(Math.round(pedido.venceEm.getTime() / 1_000) - agora, 60, 1_209_600) },
          },
          confirm: true,
          metadata: { referencia: pedido.referencia },
        },
        `pix:${pedido.referencia}`,
      ),
    )
  } catch (erro) {
    console.warn('[stripe] Pix recusado; a cobrança sai só com o link', erro instanceof Error ? erro.message : erro)
    return null
  }
}

async function criarLink(conta: string, pedido: PedidoDeCobranca): Promise<z.infer<typeof sessaoSchema> | null> {
  const agora = Math.floor(Date.now() / 1_000)
  const base =
    process.env.VERCEL_ENV === 'production'
      ? 'https://dialogon.com.br'
      : (process.env.BETTER_AUTH_URL ?? 'https://dialogon.com.br')
  try {
    return sessaoSchema.parse(
      await chamar(
        conta,
        'POST',
        '/checkout/sessions',
        {
          mode: 'payment',
          line_items: [
            {
              quantity: 1,
              price_data: { currency: 'brl', unit_amount: pedido.valorCentavos, product_data: { name: pedido.descricao.slice(0, 200) } },
            },
          ],
          client_reference_id: pedido.referencia,
          metadata: { referencia: pedido.referencia },
          payment_intent_data: { metadata: { referencia: pedido.referencia } },
          expires_at: agora + entre(Math.round(pedido.venceEm.getTime() / 1_000) - agora, 1_800, 86_400),
          success_url: base,
        },
        `link:${pedido.referencia}`,
      ),
    )
  } catch (erro) {
    console.warn('[stripe] link recusado', erro instanceof Error ? erro.message : erro)
    return null
  }
}

export const stripe: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    const [pix, link] = await Promise.all([criarPix(acesso.token, pedido), criarLink(acesso.token, pedido)])
    const copiaCola = pix?.next_action?.pix_display_qr_code?.data ?? null
    if (!copiaCola && !link?.url) throw new Error('o Stripe não criou nem o Pix nem o link')
    return {
      // O Pix é o que se cancela no vencimento; sem ele, a sessão do link.
      pagamentoId: copiaCola && pix ? pix.id : link!.id,
      preferenciaId: link?.id ?? null,
      pixCopiaCola: copiaCola,
      link: link?.url ?? null,
    }
  },

  async lerPagamento(acesso: AcessoAoGateway, pagamentoId): Promise<PagamentoLido> {
    if (pagamentoId.startsWith('cs_')) {
      const s = sessaoSchema.parse(await chamar(acesso.token, 'GET', `/checkout/sessions/${encodeURIComponent(pagamentoId)}`))
      const paga = s.payment_status === 'paid'
      return {
        pagamentoId: s.id,
        referencia: s.client_reference_id ?? null,
        situacao: paga ? 'paga' : s.status === 'expired' ? 'cancelada' : 'pendente',
        valorCentavos: s.amount_total ?? 0,
        pagaEm: paga ? new Date() : null,
      }
    }
    if (!/^pi_[A-Za-z0-9]{8,80}$/.test(pagamentoId)) throw new Error('id de pagamento do Stripe estranho')
    const p = intencaoSchema.parse(await chamar(acesso.token, 'GET', `/payment_intents/${pagamentoId}?expand[]=latest_charge`))
    const cobranca = typeof p.latest_charge === 'object' ? p.latest_charge : null
    const estornada = Boolean(cobranca?.refunded || (cobranca?.amount_refunded ?? 0) > 0)
    const paga = p.status === 'succeeded'
    return {
      pagamentoId: p.id,
      referencia: p.metadata?.referencia ?? null,
      situacao: paga && estornada ? 'estornada' : paga ? 'paga' : p.status === 'canceled' ? 'cancelada' : 'pendente',
      valorCentavos: paga ? (p.amount_received ?? p.amount) : p.amount,
      pagaEm: paga ? new Date((cobranca?.created ?? Date.now() / 1_000) * 1_000) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    if (pagamentoId.startsWith('cs_')) {
      await chamar(acesso.token, 'POST', `/checkout/sessions/${encodeURIComponent(pagamentoId)}/expire`, {})
      return
    }
    await chamar(acesso.token, 'POST', `/payment_intents/${encodeURIComponent(pagamentoId)}/cancel`, {})
  },
}
