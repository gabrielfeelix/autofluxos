import type { StatusDePedido } from '@/core/pedidos'
import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'
import type { ConectorDeCardapio } from './types'

/**
 * Foody Delivery (docs/superpowers/plans/2026-10-27-foody.md).
 *
 * O sistema de entregas da loja, não um cardápio: recebe o pedido (do
 * cardápio, de marketplace ou digitado) e despacha para o entregador. É de lá
 * que vem o link de rastreio, e por isso o "saiu para entrega" da Foody sai
 * com o botão de acompanhar. Token do lojista em Minha Conta > APIs e Hooks,
 * no cabeçalho `Authorization` sem prefixo.
 *
 * Aqui só se traduz e se chama a API. Quem decide o que o pedido faz no quadro
 * é `server/receber-pedido-de-fora.ts`.
 */

export const ENDERECO_DA_FOODY = 'https://app.foodydelivery.com/rest/1.2'

const TEMPO_LIMITE_MS = 8_000
const PEDIDOS_POR_PASSADA = 60

type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * `dispatched` e `accepted` são o entregador designado, ainda na loja: o
 * cliente só é avisado quando ele sai (`onGoing`). `rejected` (o entregador
 * recusou) e status que não conhecemos ficam `novo`: nunca anda o pedido por
 * engano.
 */
const STATUS: Record<string, StatusDePedido> = {
  open: 'novo',
  ready: 'em_preparo',
  dispatched: 'em_preparo',
  accepted: 'em_preparo',
  onGoing: 'saiu',
  delivered: 'entregue',
  closed: 'entregue',
  cancelled: 'cancelado',
}

export function statusDaFoody(status: unknown): StatusDePedido {
  return (typeof status === 'string' && STATUS[status]) || 'novo'
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const centavos = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : 0)

type Ponto = { address?: unknown; street?: unknown; houseNumber?: unknown; complement?: unknown; city?: unknown; region?: unknown }

function enderecoDe(p: Ponto | null | undefined): string | null {
  if (!p) return null
  const rua = texto(p.street) ? [texto(p.street), texto(p.houseNumber)].filter(Boolean).join(', ') : texto(p.address)
  const cidade = [texto(p.city), texto(p.region)].filter(Boolean).join('/')
  const partes = [rua, texto(p.complement), cidade].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : null
}

/**
 * O pedido da Foody (`GET /orders/{uid}`) no nosso formato. A Foody não
 * separa os itens: `orderDetails` é o texto que a loja ou o cardápio mandou,
 * e entra como uma linha só.
 */
export function traduzirPedido(bruto: unknown): PedidoDeFora | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const uid = texto(o.uid)
  if (!uid) return null
  const cliente = (o.customer ?? null) as { customerPhone?: unknown; customerName?: unknown } | null
  const detalhes = texto(o.orderDetails)
  return {
    plataforma: 'foody',
    idExterno: uid,
    numeroExibido: texto(o.id) || uid.slice(0, 8),
    status: statusDaFoody(o.status),
    telefone: texto(cliente?.customerPhone) || null,
    nome: texto(cliente?.customerName) || null,
    entrega: 'entrega',
    endereco: enderecoDe(o.deliveryPoint as Ponto | null),
    totalCentavos: centavos(o.orderTotal),
    itens: detalhes ? [{ nome: detalhes.slice(0, 200), quantidade: 1, precoCentavos: 0 }] : [],
    rastreioUrl: texto(o.orderTrackerUrl) || null,
  }
}

/** `yyyy-MM-dd'T'HH:mm:ssXXX`, o formato das datas da listagem, em Brasília. */
function dataDaFoody(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3_600_000)
  return `${local.toISOString().slice(0, 19)}-03:00`
}

async function chamar(chave: string, caminho: string, buscar: Buscar): Promise<ResultadoDaLoja<unknown>> {
  try {
    const r = await buscar(`${ENDERECO_DA_FOODY}${caminho}`, {
      headers: { Authorization: chave, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 401) return { ok: false, motivo: 'A Foody recusou o token.' }
    if (r.status === 403) return { ok: false, motivo: 'A Foody não libera a API neste plano (o gratuito não tem).' }
    if (r.status === 404) return { ok: true, valor: null }
    if (r.status === 429) return { ok: false, motivo: 'A Foody pediu para esperar (limite de consultas).' }
    if (!r.ok) return { ok: false, motivo: `A Foody respondeu ${r.status}.` }
    return { ok: true, valor: await r.json() }
  } catch {
    return { ok: false, motivo: 'A Foody não respondeu a tempo.' }
  }
}

/** Testa o token listando os pedidos da última hora. */
export async function testarTokenDaFoody(chave: string, buscar: Buscar = fetch): Promise<ResultadoDaLoja<null>> {
  const agora = new Date()
  const caminho = `/orders/?startDate=${encodeURIComponent(dataDaFoody(new Date(agora.getTime() - 3_600_000)))}&endDate=${encodeURIComponent(dataDaFoody(agora))}`
  const r = await chamar(chave, caminho, buscar)
  return r.ok ? { ok: true, valor: null } : r
}

export function conectorFoody(chave: string, buscar: Buscar = fetch): ConectorDeCardapio {
  async function lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>> {
    if (!/^[\w-]{1,64}$/.test(idExterno)) return { ok: true, valor: null }
    const r = await chamar(chave, `/orders/${idExterno}`, buscar)
    return r.ok ? { ok: true, valor: traduzirPedido(r.valor) } : r
  }

  return {
    async lerCatalogo() {
      return { ok: false, motivo: 'A Foody é sistema de entregas: não tem catálogo.' }
    },

    lerPedido,

    /**
     * A listagem é por data de criação, não de atualização. Lê o que nasceu
     * nas últimas 12 horas (o ciclo de um delivery cabe nisso) e fica com o
     * que mudou depois de `desde`. A listagem já traz o pedido inteiro.
     */
    async pedidosDesde(desde) {
      const agora = new Date()
      const de = new Date(Math.min(desde.getTime(), agora.getTime() - 12 * 3_600_000))
      const caminho = `/orders/?startDate=${encodeURIComponent(dataDaFoody(de))}&endDate=${encodeURIComponent(dataDaFoody(agora))}`
      const r = await chamar(chave, caminho, buscar)
      if (!r.ok) return r
      const lista = Array.isArray(r.valor) ? (r.valor as Record<string, unknown>[]) : []
      const pedidos: PedidoDeFora[] = []
      for (const bruto of lista) {
        const mudou = Date.parse(texto(bruto.updateDate))
        if (!Number.isNaN(mudou) && mudou < desde.getTime()) continue
        const p = traduzirPedido(bruto)
        if (p) pedidos.push(p)
        if (pedidos.length >= PEDIDOS_POR_PASSADA) break
      }
      return { ok: true, valor: pedidos }
    },
  }
}
