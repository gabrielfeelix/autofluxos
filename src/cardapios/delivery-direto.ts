import type { EntregaDoPedido, StatusDePedido } from '@/core/pedidos'
import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'
import type { ConectorDeCardapio } from './types'

/**
 * Delivery Direto (docs/superpowers/plans/2026-10-27-delivery-direto.md).
 *
 * Admin API com OAuth de senha: o lojista cria um usuário de API no painel e
 * nos passa o ID da loja (`X-DeliveryDireto-ID`), o usuário e a senha; o
 * `client_id` e o `client_secret` são nossos, de integrador, emitidos pelo
 * Delivery Direto (`DELIVERY_DIRETO_CLIENT_ID`/`_SECRET`). Sem eles a ficha
 * fica "Em breve".
 *
 * Só leitura, e só pela passada: o webhook do Delivery Direto é um por tipo
 * de evento na loja, e cadastrar o nosso poderia tirar o do PDV do lojista.
 *
 * Aqui só se traduz e se chama a API. Quem decide o que o pedido faz no quadro
 * é `server/receber-pedido-de-fora.ts`.
 */

export const ENDERECO_DO_DELIVERY_DIRETO = 'https://deliverydireto.com.br'

const TEMPO_LIMITE_MS = 8_000
const PEDIDOS_POR_PAGINA = 100
const PAGINAS_POR_PASSADA = 3

type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

export type CredencialDoDeliveryDireto = {
  loja: string
  usuario: string
  senha: string
  clientId: string
  clientSecret: string
}

const ENTREGA: Record<string, EntregaDoPedido> = { DELIVERY: 'entrega', TAKEOUT: 'retirada', DESK: 'local' }

/**
 * O Delivery Direto não tem "em preparo" nem "pronto" separados: `APPROVED`
 * é a loja aceitando, e `IN_TRANSIT` é o pedido a caminho (ou pronto, na
 * retirada). `HIDDEN` (agendado ou apagado), `WARNING` (pagamento on-line com
 * problema) e o que não conhecemos ficam `novo`: nunca anda o pedido por engano.
 */
const STATUS: Record<string, StatusDePedido> = {
  WAITING: 'novo',
  APPROVED: 'em_preparo',
  IN_TRANSIT: 'saiu',
  DONE: 'entregue',
  REJECTED: 'cancelado',
}

export function statusDoDeliveryDireto(status: unknown): StatusDePedido {
  return (typeof status === 'string' && STATUS[status]) || 'novo'
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
/** Dinheiro do Delivery Direto: `{ value, currency }` com `value` já em centavos. */
const centavos = (v: unknown): number => {
  const valor = v && typeof v === 'object' ? (v as { value?: unknown }).value : v
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : 0
}

type Endereco = {
  street?: unknown
  number?: unknown
  complement?: unknown
  neighborhood?: unknown
  city?: unknown
  state?: unknown
  reference_point?: unknown
}

function enderecoDe(e: Endereco | null | undefined): string | null {
  if (!e) return null
  const cidade = [texto(e.city), texto(e.state)].filter(Boolean).join('/')
  const partes = [texto(e.street), texto(e.number), texto(e.complement), texto(e.neighborhood), cidade].filter(Boolean)
  if (partes.length === 0) return null
  const referencia = texto(e.reference_point)
  return `${partes.join(', ')}${referencia ? ` (${referencia})` : ''}`
}

/**
 * Um pedido da listagem (`GET /admin-api/v1/orders`) no nosso formato, ou
 * `null` para mesa. Pedido por telefone (`BY_PHONE`) é entrega quando tem
 * endereço, retirada quando não tem.
 */
export function traduzirPedido(bruto: unknown): PedidoDeFora | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const id = texto(o.id)
  const tipo = texto(o.type)
  const endereco = enderecoDe(o.address as Endereco | null)
  const entrega = tipo === 'BY_PHONE' ? (endereco ? 'entrega' : 'retirada') : ENTREGA[tipo]
  if (!entrega || !id) return null
  const cliente = (o.customer ?? null) as { telephone?: unknown; firstName?: unknown; lastName?: unknown } | null
  const nome = [texto(cliente?.firstName), texto(cliente?.lastName)].filter(Boolean).join(' ')
  const itens = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : []
  const total = (o.total ?? null) as { total?: unknown } | null
  return {
    plataforma: 'delivery_direto',
    idExterno: id,
    numeroExibido: texto(o.orderNumber) || texto(o.sequentialId) || id,
    status: o.isCanceled === true ? 'cancelado' : statusDoDeliveryDireto(o.status),
    telefone: texto(cliente?.telephone) || null,
    nome: nome || null,
    entrega,
    endereco: entrega === 'entrega' ? endereco : null,
    totalCentavos: centavos(total?.total),
    itens: itens.map((i) => ({
      nome: texto(i.name),
      quantidade: typeof i.amount === 'number' ? i.amount : 1,
      precoCentavos: centavos(i.totalPrice ?? i.total ?? i.price),
    })),
    rastreioUrl: null,
  }
}

/** O token dura 6 horas: fica em memória, por instância. */
const TOKENS = new Map<string, { token: string; vence: number }>()

export function esquecerTokensDoDeliveryDireto(): void {
  TOKENS.clear()
}

const cabecalhos = (c: CredencialDoDeliveryDireto) => ({
  'X-DeliveryDireto-ID': c.loja,
  'X-DeliveryDireto-Client-Id': c.clientId,
  Accept: 'application/json',
})

async function token(c: CredencialDoDeliveryDireto, buscar: Buscar): Promise<ResultadoDaLoja<string>> {
  const chave = `${c.loja}|${c.usuario}`
  const guardado = TOKENS.get(chave)
  if (guardado && guardado.vence > Date.now()) return { ok: true, valor: guardado.token }
  try {
    const r = await buscar(`${ENDERECO_DO_DELIVERY_DIRETO}/admin-api/token`, {
      method: 'POST',
      headers: { ...cabecalhos(c), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: c.usuario,
        password: c.senha,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 400 || r.status === 401) return { ok: false, motivo: 'O Delivery Direto recusou o ID da loja, o usuário ou a senha.' }
    if (!r.ok) return { ok: false, motivo: `O Delivery Direto respondeu ${r.status} ao pedir o token.` }
    const corpo = (await r.json()) as { access_token?: unknown; expires_in?: unknown }
    const valor = texto(corpo.access_token)
    if (!valor) return { ok: false, motivo: 'O Delivery Direto não devolveu o token.' }
    const segundos = typeof corpo.expires_in === 'number' ? corpo.expires_in : 3600
    TOKENS.set(chave, { token: valor, vence: Date.now() + Math.max(60, segundos - 600) * 1000 })
    return { ok: true, valor }
  } catch {
    return { ok: false, motivo: 'O Delivery Direto não respondeu a tempo.' }
  }
}

async function chamar(c: CredencialDoDeliveryDireto, caminho: string, buscar: Buscar): Promise<ResultadoDaLoja<unknown>> {
  const t = await token(c, buscar)
  if (!t.ok) return t
  try {
    const r = await buscar(`${ENDERECO_DO_DELIVERY_DIRETO}${caminho}`, {
      headers: { ...cabecalhos(c), Authorization: `Bearer ${t.valor}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 401) {
      TOKENS.delete(`${c.loja}|${c.usuario}`)
      return { ok: false, motivo: 'O Delivery Direto recusou o token.' }
    }
    if (r.status === 429) return { ok: false, motivo: 'O Delivery Direto pediu para esperar (limite de consultas).' }
    if (!r.ok) return { ok: false, motivo: `O Delivery Direto respondeu ${r.status}.` }
    return { ok: true, valor: await r.json() }
  } catch {
    return { ok: false, motivo: 'O Delivery Direto não respondeu a tempo.' }
  }
}

type Pagina = { data?: { orders?: unknown } }

const pedidosDa = (v: unknown): Record<string, unknown>[] => {
  const lista = (v as Pagina | null)?.data?.orders
  return Array.isArray(lista) ? (lista as Record<string, unknown>[]) : []
}

/** `YYYY-MM-DD` em Brasília, o formato dos filtros de data. */
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Testa a credencial: o token sai e a listagem responde. */
export async function testarDeliveryDireto(c: CredencialDoDeliveryDireto, buscar: Buscar = fetch): Promise<ResultadoDaLoja<null>> {
  const hoje = DIA.format(new Date())
  const r = await chamar(c, `/admin-api/v1/orders?dateStart=${hoje}&dateEnd=${hoje}&limit=1`, buscar)
  return r.ok ? { ok: true, valor: null } : r
}

export function conectorDeliveryDireto(c: CredencialDoDeliveryDireto, buscar: Buscar = fetch): ConectorDeCardapio {
  return {
    async lerCatalogo() {
      return { ok: false, motivo: 'O catálogo do Delivery Direto ainda não é importado.' }
    },

    async lerPedido(idExterno) {
      if (!/^\d{1,20}$/.test(idExterno)) return { ok: true, valor: null }
      const r = await chamar(c, `/admin-api/v1/orders?ordersId=${idExterno}&showItems=true&includeCanceledOrders=true`, buscar)
      if (!r.ok) return r
      const achado = pedidosDa(r.valor).find((o) => texto(o.id) === idExterno)
      return { ok: true, valor: achado ? traduzirPedido(achado) : null }
    },

    /** O filtro de modificação é por dia: lê do dia de `desde` até hoje e fica com o que mudou depois dele. */
    async pedidosDesde(desde) {
      const de = DIA.format(desde)
      const ate = DIA.format(new Date())
      const pedidos: PedidoDeFora[] = []
      for (let pagina = 0; pagina < PAGINAS_POR_PASSADA; pagina++) {
        const r = await chamar(
          c,
          `/admin-api/v1/orders?lastModifiedStart=${de}&lastModifiedEnd=${ate}&includeCanceledOrders=true&showItems=true&limit=${PEDIDOS_POR_PAGINA}&offset=${pagina * PEDIDOS_POR_PAGINA}`,
          buscar,
        )
        if (!r.ok) return r
        const lista = pedidosDa(r.valor)
        for (const bruto of lista) {
          const mudou = Date.parse(texto(bruto.modified))
          if (!Number.isNaN(mudou) && mudou < desde.getTime()) continue
          const p = traduzirPedido(bruto)
          if (p) pedidos.push(p)
        }
        if (lista.length < PEDIDOS_POR_PAGINA) break
      }
      return { ok: true, valor: pedidos }
    },
  }
}
