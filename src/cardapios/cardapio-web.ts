import type { EntregaDoPedido, StatusDePedido } from '@/core/pedidos'
import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'
import type { ConectorDeCardapio } from './types'

/**
 * Cardápio Web (docs/superpowers/plans/2026-10-27-cardapio-web.md).
 *
 * Pedidos com a chave de API do lojista (`X-API-KEY`, gerada no Portal em
 * Configurações > Integrações > API). O catálogo exige a chave de integradora
 * (`X-PARTNER-KEY`), que a Cardápio Web emite por e-mail: até lá,
 * `lerCatalogo` devolve o motivo em vez de tentar.
 *
 * Aqui só se traduz. Quem decide o que o pedido faz no quadro é
 * `server/receber-pedido-de-fora.ts`.
 */

export const ENDERECO_DO_CARDAPIO_WEB = 'https://integracao.cardapioweb.com/api/partner/v1'

const TEMPO_LIMITE_MS = 8_000
/** A passada lê no máximo isto por volta: 300 requisições a cada 3 min é o limite da loja. */
const PEDIDOS_POR_PASSADA = 60

type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

const STATUS: Record<string, StatusDePedido> = {
  waiting_confirmation: 'novo',
  pending_payment: 'novo',
  pending_online_payment: 'novo',
  scheduled_confirmed: 'novo',
  confirmed: 'em_preparo',
  ready: 'em_preparo',
  released: 'saiu',
  waiting_to_catch: 'saiu',
  delivered: 'entregue',
  closed: 'entregue',
  canceled: 'cancelado',
}

/** Status que não conhecemos fica `novo`: nunca anda o pedido por engano. */
export function statusDoCardapioWeb(status: unknown): StatusDePedido {
  return (typeof status === 'string' && STATUS[status]) || 'novo'
}

const ENTREGA: Record<string, EntregaDoPedido> = { delivery: 'entrega', takeout: 'retirada', onsite: 'local' }

type Endereco = {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  complement?: string | null
  reference?: string | null
  city?: string | null
  state?: string | null
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const centavos = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : 0)

function enderecoDe(e: Endereco | null | undefined): string | null {
  if (!e) return null
  const cidade = [texto(e.city), texto(e.state)].filter(Boolean).join('/')
  const partes = [texto(e.street), texto(e.number), texto(e.complement), texto(e.neighborhood), cidade].filter(Boolean)
  if (partes.length === 0) return null
  const referencia = texto(e.reference)
  return `${partes.join(', ')}${referencia ? ` (${referencia})` : ''}`
}

/** O pedido completo (`GET /orders/{id}`) no nosso formato, ou `null` para mesa e comanda. */
export function traduzirPedido(bruto: unknown): PedidoDeFora | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const entrega = ENTREGA[texto(o.order_type)]
  const id = texto(o.id)
  if (!entrega || !id) return null
  const cliente = (o.customer ?? null) as { phone?: unknown; name?: unknown } | null
  const itens = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : []
  return {
    plataforma: 'cardapio_web',
    idExterno: id,
    numeroExibido: texto(o.external_display_id) || texto(o.display_id) || id,
    status: statusDoCardapioWeb(o.status),
    telefone: texto(cliente?.phone) || null,
    nome: texto(cliente?.name) || null,
    entrega,
    endereco: entrega === 'entrega' ? enderecoDe(o.delivery_address as Endereco | null) : null,
    totalCentavos: centavos(o.total),
    itens: itens.map((i) => ({
      nome: texto(i.name),
      quantidade: typeof i.quantity === 'number' ? i.quantity : 1,
      precoCentavos: centavos(i.total_price ?? i.unit_price),
    })),
    rastreioUrl: null,
  }
}

async function chamar(chave: string, caminho: string, buscar: Buscar): Promise<ResultadoDaLoja<unknown>> {
  try {
    const r = await buscar(`${ENDERECO_DO_CARDAPIO_WEB}${caminho}`, {
      headers: { 'X-API-KEY': chave, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'O Cardápio Web recusou a chave de API.' }
    if (r.status === 404) return { ok: true, valor: null }
    if (r.status === 429) return { ok: false, motivo: 'O Cardápio Web pediu para esperar (limite de consultas).' }
    if (!r.ok) return { ok: false, motivo: `O Cardápio Web respondeu ${r.status}.` }
    return { ok: true, valor: await r.json() }
  } catch {
    return { ok: false, motivo: 'O Cardápio Web não respondeu a tempo.' }
  }
}

/** A loja da chave (`GET /merchant`): é o teste da chave e o `merchant_id` que os webhooks trazem. */
export async function lojaDoCardapioWeb(
  chave: string,
  buscar: Buscar = fetch,
): Promise<ResultadoDaLoja<{ id: string; nome: string }>> {
  const r = await chamar(chave, '/merchant', buscar)
  if (!r.ok) return r
  const loja = (r.valor ?? {}) as { id?: unknown; name?: unknown; display_name?: unknown }
  const id = texto(loja.id)
  if (!id) return { ok: false, motivo: 'O Cardápio Web não devolveu a loja desta chave.' }
  return { ok: true, valor: { id, nome: texto(loja.display_name) || texto(loja.name) } }
}

export function conectorCardapioWeb(chave: string, buscar: Buscar = fetch): ConectorDeCardapio {
  async function lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>> {
    if (!/^\d{1,20}$/.test(idExterno)) return { ok: true, valor: null }
    const r = await chamar(chave, `/orders/${idExterno}`, buscar)
    return r.ok ? { ok: true, valor: traduzirPedido(r.valor) } : r
  }

  return {
    async lerCatalogo() {
      return { ok: false, motivo: 'O catálogo do Cardápio Web exige a chave de integradora, ainda não emitida.' }
    },

    lerPedido,

    async pedidosDesde(desde) {
      // A API aceita no máximo 24 horas para trás.
      const limite = new Date(Date.now() - 23.5 * 3_600_000)
      const de = desde < limite ? limite : desde
      const r = await chamar(chave, `/orders?updated_since=${encodeURIComponent(de.toISOString())}`, buscar)
      if (!r.ok) return r
      const resumidos = Array.isArray(r.valor) ? (r.valor as { id?: unknown }[]) : []
      const pedidos: PedidoDeFora[] = []
      for (const resumo of resumidos.slice(0, PEDIDOS_POR_PASSADA)) {
        const lido = await lerPedido(texto(resumo.id))
        if (!lido.ok) return lido
        if (lido.valor) pedidos.push(lido.valor)
      }
      return { ok: true, valor: pedidos }
    },
  }
}
