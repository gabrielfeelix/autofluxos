import type { EntregaDoPedido, StatusDePedido } from '@/core/pedidos'
import type { PedidoDeFora, PlataformaDePedido } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'
import type { ConectorDeCardapio } from './types'

/**
 * Open Delivery, o padrão da Abrasel (docs/superpowers/plans/2026-10-27-goomer.md).
 *
 * Genérico: a base e a plataforma vêm de quem chama. A Goomer é a primeira
 * (`ENDERECO_DA_GOOMER`); outro cardápio que fale Open Delivery entra com a
 * base dele. Somos o "software service" que só escuta: lemos a fila de
 * eventos da nossa credencial, relemos o pedido e confirmamos. Nunca mudamos
 * o status lá.
 *
 * Aqui só se traduz e se chama a API. Quem decide o que o pedido faz no quadro
 * é `server/receber-pedido-de-fora.ts`.
 */

export const ENDERECO_DA_GOOMER = 'https://partner-api.goomer.app/opendelivery'

const TEMPO_LIMITE_MS = 8_000
/** Pedidos completos lidos por passada: o limite do pedido é 100 por minuto. */
const PEDIDOS_POR_PASSADA = 60
const CONFIRMACOES_POR_CHAMADA = 100

type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

export type CredencialOpenDelivery = { base: string; clientId: string; clientSecret: string }

const ENTREGA: Record<string, EntregaDoPedido> = { DELIVERY: 'entrega', TAKEOUT: 'retirada', INDOOR: 'local' }

const STATUS: Record<string, StatusDePedido> = {
  CREATED: 'novo',
  CONFIRMED: 'em_preparo',
  PREPARATION_REQUESTED: 'em_preparo',
  PREPARING: 'em_preparo',
  PICKUP_AREA_ASSIGNED: 'em_preparo',
  DISPATCHED: 'saiu',
  PICKED_UP: 'saiu',
  DELIVERED: 'entregue',
  CONCLUDED: 'entregue',
  CANCELLED: 'cancelado',
}

/**
 * `READY_FOR_PICKUP` na retirada é "pronto para retirar" (nosso `saiu`); na
 * entrega é esperar o motoboy. Pedido de cancelamento ainda não decidido, e
 * todo status que não conhecemos, fica `novo`: nunca anda o pedido por engano.
 */
export function statusDoOpenDelivery(evento: unknown, entrega: EntregaDoPedido): StatusDePedido {
  if (evento === 'READY_FOR_PICKUP') return entrega === 'entrega' ? 'em_preparo' : 'saiu'
  return (typeof evento === 'string' && STATUS[evento]) || 'novo'
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
/** Valor do Open Delivery: `{ value, currency }` em reais com decimais. */
const centavos = (v: unknown): number => {
  const valor = v && typeof v === 'object' ? (v as { value?: unknown }).value : v
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor * 100) : 0
}

type Endereco = {
  formattedAddress?: unknown
  street?: unknown
  number?: unknown
  complement?: unknown
  district?: unknown
  city?: unknown
  state?: unknown
  reference?: unknown
}

function enderecoDe(e: Endereco | null | undefined): string | null {
  if (!e) return null
  const cidade = [texto(e.city), texto(e.state)].filter(Boolean).join('/')
  const partes = [texto(e.street), texto(e.number), texto(e.complement), texto(e.district), cidade].filter(Boolean)
  const base = partes.length > 0 ? partes.join(', ') : texto(e.formattedAddress)
  if (!base) return null
  const referencia = texto(e.reference)
  return `${base}${referencia ? ` (${referencia})` : ''}`
}

/** O pedido Open Delivery (`GET /v1/orders/{id}`) no nosso formato, ou `null` para mesa. */
export function traduzirPedido(bruto: unknown, plataforma: PlataformaDePedido): PedidoDeFora | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const entrega = ENTREGA[texto(o.type)]
  const id = texto(o.id)
  if (!entrega || !id) return null
  if (entrega === 'local' && texto((o.indoor as { mode?: unknown } | null)?.mode) === 'TABLE') return null
  const cliente = (o.customer ?? null) as { name?: unknown; phone?: { number?: unknown } | null } | null
  const itens = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : []
  const total = (o.total ?? null) as { orderAmount?: unknown } | null
  const delivery = (o.delivery ?? null) as { deliveryAddress?: Endereco | null } | null
  return {
    plataforma,
    idExterno: id,
    numeroExibido: texto(o.displayId) || id,
    status: statusDoOpenDelivery(o.lastEvent, entrega),
    telefone: texto(cliente?.phone?.number) || null,
    nome: texto(cliente?.name) || null,
    entrega,
    endereco: entrega === 'entrega' ? enderecoDe(delivery?.deliveryAddress) : null,
    totalCentavos: centavos(total?.orderAmount),
    itens: itens.map((i) => ({
      nome: texto(i.name),
      quantidade: typeof i.quantity === 'number' ? i.quantity : 1,
      precoCentavos: centavos(i.totalPrice ?? i.unitPrice),
    })),
    rastreioUrl: null,
  }
}

export type EventoOpenDelivery = { id: string; pedidoId: string; tipo: string; criadoEm: Date | null }

/**
 * O token dura 7 dias e a Goomer só emite 10 por hora: fica em memória, por
 * instância. Instância nova pede outro, e a passada de 10 minutos pede no
 * máximo 6 por hora por conta.
 */
const TOKENS = new Map<string, { token: string; vence: number }>()

export function esquecerTokens(): void {
  TOKENS.clear()
}

async function token(c: CredencialOpenDelivery, buscar: Buscar): Promise<ResultadoDaLoja<string>> {
  const chave = `${c.base}|${c.clientId}`
  const guardado = TOKENS.get(chave)
  if (guardado && guardado.vence > Date.now()) return { ok: true, valor: guardado.token }
  try {
    const r = await buscar(`${c.base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 400 || r.status === 401 || r.status === 403) return { ok: false, motivo: 'O Client Id ou o Client Secret foi recusado.' }
    if (r.status === 429) return { ok: false, motivo: 'Muitas tentativas de conexão na última hora. Tente de novo mais tarde.' }
    if (!r.ok) return { ok: false, motivo: `O Open Delivery respondeu ${r.status} ao pedir o token.` }
    const corpo = (await r.json()) as { access_token?: unknown; expires_in?: unknown }
    const valor = texto(corpo.access_token)
    if (!valor) return { ok: false, motivo: 'O Open Delivery não devolveu o token.' }
    const segundos = typeof corpo.expires_in === 'number' ? corpo.expires_in : 3600
    // Uma hora de folga: token vencendo no meio da passada vira 401 à toa.
    TOKENS.set(chave, { token: valor, vence: Date.now() + Math.max(60, segundos - 3600) * 1000 })
    return { ok: true, valor }
  } catch {
    return { ok: false, motivo: 'O Open Delivery não respondeu a tempo.' }
  }
}

type Chamada = { metodo?: 'GET' | 'POST'; corpo?: unknown }

async function chamar(c: CredencialOpenDelivery, caminho: string, buscar: Buscar, chamada: Chamada = {}): Promise<ResultadoDaLoja<unknown>> {
  const t = await token(c, buscar)
  if (!t.ok) return t
  try {
    const r = await buscar(`${c.base}${caminho}`, {
      method: chamada.metodo ?? 'GET',
      headers: {
        Authorization: `Bearer ${t.valor}`,
        Accept: 'application/json',
        ...(chamada.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: chamada.corpo === undefined ? undefined : JSON.stringify(chamada.corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 401) {
      TOKENS.delete(`${c.base}|${c.clientId}`)
      return { ok: false, motivo: 'O Open Delivery recusou o token.' }
    }
    if (r.status === 404) return { ok: true, valor: null }
    if (r.status === 429) return { ok: false, motivo: 'O Open Delivery pediu para esperar (limite de consultas).' }
    if (!r.ok) return { ok: false, motivo: `O Open Delivery respondeu ${r.status}.` }
    if (r.status === 202 || r.status === 204) return { ok: true, valor: null }
    const corpo = await r.text()
    return { ok: true, valor: corpo ? (JSON.parse(corpo) as unknown) : null }
  } catch {
    return { ok: false, motivo: 'O Open Delivery não respondeu a tempo.' }
  }
}

/** Testa a credencial (o token sai) e devolve o nome da loja, se o `/merchant` responder. */
export async function lojaDoOpenDelivery(c: CredencialOpenDelivery, buscar: Buscar = fetch): Promise<ResultadoDaLoja<{ nome: string }>> {
  const t = await token(c, buscar)
  if (!t.ok) return t
  const loja = await chamar(c, '/v1/merchant', buscar)
  const info = loja.ok ? ((loja.valor ?? {}) as { basicInfo?: { name?: unknown } }).basicInfo : undefined
  return { ok: true, valor: { nome: texto(info?.name) } }
}

export type ConectorOpenDelivery = ConectorDeCardapio & {
  /** A fila de eventos da nossa credencial. Evento só sai dela depois de `confirmar`. */
  lerEventos(): Promise<ResultadoDaLoja<EventoOpenDelivery[]>>
  confirmar(eventos: EventoOpenDelivery[]): Promise<ResultadoDaLoja<null>>
}

export function conectorOpenDelivery(
  c: CredencialOpenDelivery,
  plataforma: PlataformaDePedido,
  buscar: Buscar = fetch,
): ConectorOpenDelivery {
  async function lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>> {
    if (!/^[\w-]{1,64}$/.test(idExterno)) return { ok: true, valor: null }
    const r = await chamar(c, `/v1/orders/${idExterno}`, buscar)
    return r.ok ? { ok: true, valor: traduzirPedido(r.valor, plataforma) } : r
  }

  async function lerEventos(): Promise<ResultadoDaLoja<EventoOpenDelivery[]>> {
    const r = await chamar(c, '/v1/events:polling', buscar)
    if (!r.ok) return r
    const lista = Array.isArray(r.valor) ? (r.valor as Record<string, unknown>[]) : []
    return {
      ok: true,
      valor: lista
        .map((e) => {
          const quando = Date.parse(texto(e.createdAt))
          return {
            id: texto(e.eventId),
            pedidoId: texto(e.orderId),
            tipo: texto(e.eventType),
            criadoEm: Number.isNaN(quando) ? null : new Date(quando),
          }
        })
        .filter((e) => e.id && e.pedidoId),
    }
  }

  async function confirmar(eventos: EventoOpenDelivery[]): Promise<ResultadoDaLoja<null>> {
    for (let i = 0; i < eventos.length; i += CONFIRMACOES_POR_CHAMADA) {
      const lote = eventos.slice(i, i + CONFIRMACOES_POR_CHAMADA).map((e) => ({ id: e.id, orderId: e.pedidoId, eventType: e.tipo }))
      const r = await chamar(c, '/v1/events/acknowledgment', buscar, { metodo: 'POST', corpo: lote })
      if (!r.ok) return r
    }
    return { ok: true, valor: null }
  }

  return {
    async lerCatalogo() {
      return { ok: false, motivo: 'O catálogo do Open Delivery ainda não é importado.' }
    },

    lerPedido,
    lerEventos,
    confirmar,

    /** Os pedidos dos eventos na fila depois de `desde`, sem confirmar: quem confirma é a passada, depois de gravar. */
    async pedidosDesde(desde) {
      const eventos = await lerEventos()
      if (!eventos.ok) return eventos
      const ids = [...new Set(eventos.valor.filter((e) => !e.criadoEm || e.criadoEm >= desde).map((e) => e.pedidoId))]
      const pedidos: PedidoDeFora[] = []
      for (const id of ids.slice(0, PEDIDOS_POR_PASSADA)) {
        const lido = await lerPedido(id)
        if (!lido.ok) return lido
        if (lido.valor) pedidos.push(lido.valor)
      }
      return { ok: true, valor: pedidos }
    },
  }
}
