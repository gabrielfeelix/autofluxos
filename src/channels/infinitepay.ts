import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import type { CobrancaCriada, GatewayDePagamento, PagamentoLido } from './pagamento'

/**
 * A InfinitePay pelo Checkout Integrado (https://www.infinitepay.io/checkout-documentacao).
 *
 * Diferente do Mercado Pago e do Asaas em quatro pontos, e cada um muda algo:
 *
 * 1. **Não há chave.** A conta é identificada só pela InfiniteTag (o `$` da
 *    conta, guardado sem o `$`). Conectar é digitar o @; o `token` do acesso é
 *    a tag. Não há como provar que a tag é de quem digitou: o pior que se faz
 *    com a tag de outro é criar link que paga **para o outro**, e por isso a
 *    tela pede a do próprio dono e a mesma tag não liga em duas organizações.
 * 2. **Só link.** A API devolve a página de pagamento, sem Pix copia e cola:
 *    a conversa manda o link, e a pessoa paga ali por Pix ou cartão.
 * 3. **O aviso não é assinado.** O endereço do aviso leva um segredo nosso
 *    (`segredoDoAviso`), e o pagamento é relido no `payment_check` antes de
 *    valer, como no Asaas.
 * 4. **Não há cancelar nem sandbox.** Cobrança vencida deixa o link aberto; se
 *    a pessoa pagar depois, o aviso marca como paga, que é o que vale. Testar é
 *    com dinheiro de verdade (R$ 1).
 */

const BASE = 'https://api.checkout.infinitepay.io'
const PRAZO_MS = 10_000

export class ErroDaInfinitePay extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

/** A tag como a API quer: sem `$`, sem espaço. `null` se não parece uma tag. */
export function tagDaInfinitePay(bruta: string): string | null {
  const limpa = bruta.trim().replace(/^[$@]/, '').toLowerCase()
  return /^[a-z0-9][a-z0-9_.-]{1,39}$/.test(limpa) ? limpa : null
}

async function chamar<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Dialogon/1.0' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  const json = await resposta.json().catch(() => null)
  // Só o status: a resposta de erro pode trazer o nome de quem paga.
  if (!resposta.ok) throw new ErroDaInfinitePay(`a InfinitePay recusou ${caminho} (${resposta.status})`, resposta.status)
  return json as T
}

// ---------------------------------------------------------------------------
// O aviso
// ---------------------------------------------------------------------------

/** O segredo que vai no endereço do aviso. Derivado, como o do Asaas: conferido antes de tocar o banco. */
export function segredoDoAviso(clienteId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o aviso da InfinitePay')
  return createHmac('sha256', `infinitepay:${chave}`).update(clienteId).digest('hex')
}

export function avisoAutentico(clienteId: string, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, segredoDoAviso(clienteId))
  } catch {
    return false
  }
}

function enderecoDoAviso(clienteId: string): string | null {
  const base = process.env.VERCEL_ENV === 'production' ? 'https://dialogon.com.br' : process.env.BETTER_AUTH_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/api/webhook/infinitepay/${clienteId}?t=${segredoDoAviso(clienteId)}`
}

const avisoSchema = z.object({
  invoice_slug: z.string().min(1),
  transaction_nsu: z.string().min(1),
  order_nsu: z.string().min(1),
})

/**
 * O que o aviso diz, num id só: `slug|transação|pedido`. É o que
 * `lerPagamento` precisa para o `payment_check`, e cabe na assinatura comum
 * dos gateways (`aplicarPagamento(cliente, gateway, pagamentoId)`).
 */
export function pagamentoDoAviso(corpo: unknown): string | null {
  const lido = avisoSchema.safeParse(corpo)
  if (!lido.success) return null
  const { invoice_slug, transaction_nsu, order_nsu } = lido.data
  if ([invoice_slug, transaction_nsu, order_nsu].some((parte) => parte.includes('|'))) return null
  return `${invoice_slug}|${transaction_nsu}|${order_nsu}`
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

/** A resposta do `/links` não está documentada; o link pode vir com nomes diferentes. */
function linkDaResposta(json: unknown): string | null {
  const achar = (valor: unknown): string | null => {
    if (!valor || typeof valor !== 'object') return null
    const objeto = valor as Record<string, unknown>
    for (const campo of ['url', 'link', 'checkout_url', 'payment_url']) {
      const v = objeto[campo]
      if (typeof v === 'string' && /^https:\/\//.test(v)) return v
    }
    return achar(objeto.data)
  }
  return achar(json)
}

const conferenciaSchema = z.object({
  success: z.boolean().optional(),
  paid: z.boolean(),
  amount: z.number().optional(),
  paid_amount: z.number().optional(),
})

export const infinitepay: GatewayDePagamento = {
  async criarCobranca(acesso, pedido): Promise<CobrancaCriada> {
    const aviso = pedido.clienteId ? enderecoDoAviso(pedido.clienteId) : null
    const resposta = await chamar<unknown>('/links', {
      handle: acesso.token,
      // Uma linha com o total: a cobrança da conversa já vem somada.
      items: [{ quantity: 1, price: pedido.valorCentavos, description: pedido.descricao.slice(0, 120) }],
      order_nsu: pedido.referencia,
      // Sem endereço (fora de produção, sem BETTER_AUTH_URL), cobra igual; o pago só chega pelo aviso.
      ...(aviso ? { webhook_url: aviso } : {}),
      ...(pedido.pagador.nome || pedido.pagador.email || pedido.pagador.telefone
        ? {
            customer: {
              ...(pedido.pagador.nome ? { name: pedido.pagador.nome.slice(0, 100) } : {}),
              ...(pedido.pagador.email ? { email: pedido.pagador.email } : {}),
              ...(pedido.pagador.telefone ? { phone_number: `+${pedido.pagador.telefone}` } : {}),
            },
          }
        : {}),
    })
    const link = linkDaResposta(resposta)
    if (!link) throw new ErroDaInfinitePay('a InfinitePay respondeu sem o link de pagamento', 200)
    return { pagamentoId: `pedido|${pedido.referencia}`, preferenciaId: null, pixCopiaCola: null, link }
  },

  /**
   * Só confere o que veio do aviso (`slug|transação|pedido`). O id guardado na
   * criação (`pedido|<referência>`) não tem transação, e sem ela o
   * `payment_check` não responde: fica pendente, e quem decide é o aviso.
   */
  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    const [slug, transacao, pedido] = pagamentoId.split('|')
    if (slug === 'pedido' || !slug || !transacao || !pedido) {
      return { pagamentoId, referencia: null, situacao: 'pendente', valorCentavos: 0, pagaEm: null }
    }
    const conferido = conferenciaSchema.parse(
      await chamar('/payment_check', { handle: acesso.token, order_nsu: pedido, transaction_nsu: transacao, slug }),
    )
    return {
      pagamentoId,
      referencia: pedido,
      situacao: conferido.paid ? 'paga' : 'pendente',
      // `amount` é o valor da cobrança; `paid_amount` inclui o juro do parcelamento que o pagador assumiu.
      valorCentavos: conferido.amount ?? conferido.paid_amount ?? 0,
      pagaEm: conferido.paid ? new Date() : null,
    }
  },

  /** Não há como cancelar um link na InfinitePay. Vencer é decisão nossa; o link fica. */
  async cancelarPagamento() {},
}
