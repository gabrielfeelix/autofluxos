import { createHmac, timingSafeEqual } from 'node:crypto'
import type { EntregaDoPedido, StatusDePedido } from '@/core/pedidos'
import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'
import type { ConectorDeCardapio } from './types'

/**
 * OlaClick (docs/superpowers/plans/2026-10-27-olaclick.md).
 *
 * Tudo com a chave de API do lojista (`olk_live_...`, Integrações > API Keys
 * no painel, planos pagos). Diferente do Cardápio Web, o webhook se registra
 * pela API: o lojista só cola a chave, e a OlaClick devolve o segredo com que
 * assina cada entrega.
 *
 * Aqui só se traduz e se chama a API. Quem decide o que o pedido faz no quadro
 * é `server/receber-pedido-de-fora.ts`.
 */

export const ENDERECO_DA_OLACLICK = 'https://public-api.olaclick.app/v1'

const TEMPO_LIMITE_MS = 8_000
/** A passada busca no máximo isto de pedidos completos por volta: o limite é por chave. */
const PEDIDOS_POR_PASSADA = 60
const PAGINAS_POR_PASSADA = 6

type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

const ENTREGA: Record<string, EntregaDoPedido> = { DELIVERY: 'entrega', TAKEAWAY: 'retirada', ONSITE: 'local' }

const STATUS: Record<string, StatusDePedido> = {
  INITIATED: 'novo',
  PENDING: 'novo',
  PREPARING: 'em_preparo',
  CHECK_REQUESTED: 'em_preparo',
  CHECK_PRINTED: 'em_preparo',
  DRIVER_ON_THE_WAY_TO_DESTINATION: 'saiu',
  DRIVER_ARRIVED_AT_DESTINATION: 'saiu',
  DELIVERED: 'entregue',
  FINALIZED: 'entregue',
  CANCELLED: 'cancelado',
}

/**
 * `READY` depende de como o pedido sai: na retirada é "pronto para retirar"
 * (nosso `saiu`); na entrega é esperar o motoboy, e só vira `saiu` quando a
 * entrega já está a caminho. Status que não conhecemos fica `novo`: nunca anda
 * o pedido por engano.
 */
export function statusDaOlaClick(status: unknown, entrega: EntregaDoPedido, statusDaEntrega?: unknown): StatusDePedido {
  if (status === 'READY') {
    if (entrega !== 'entrega') return 'saiu'
    return statusDaEntrega === 'DELIVERING' ? 'saiu' : 'em_preparo'
  }
  return (typeof status === 'string' && STATUS[status]) || 'novo'
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const centavos = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : 0)

/** O número com DDI. A OlaClick separa os dois, e às vezes o número já vem com ele. */
function telefoneDe(numero: unknown, ddi: unknown): string | null {
  const digitos = texto(numero).replace(/\D/g, '')
  if (!digitos) return null
  const codigo = texto(ddi).replace(/\D/g, '')
  if (!codigo || (digitos.startsWith(codigo) && digitos.length >= 12)) return digitos
  return `${codigo}${digitos}`
}

type Endereco = { address?: unknown; complement?: unknown; reference?: unknown; area_name?: unknown }

function enderecoDe(e: Endereco | null | undefined): string | null {
  if (!e) return null
  const partes = [texto(e.address), texto(e.complement), texto(e.area_name)].filter(Boolean)
  if (partes.length === 0) return null
  const referencia = texto(e.reference)
  return `${partes.join(', ')}${referencia ? ` (${referencia})` : ''}`
}

/** O pedido completo (`GET /orders/{id}`, já sem o envelope `data`) no nosso formato, ou `null` para mesa. */
export function traduzirPedido(bruto: unknown): PedidoDeFora | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const entrega = ENTREGA[texto(o.service_type)]
  const id = texto(o.id)
  if (!entrega || !id) return null
  const cliente = (o.client ?? null) as { phone_number?: unknown; country_calling_code?: unknown; name?: unknown } | null
  const itens = Array.isArray(o.combos) ? (o.combos as Record<string, unknown>[]) : []
  return {
    plataforma: 'olaclick',
    idExterno: id,
    numeroExibido: texto(o.daily_id) || texto(o.public_id) || id,
    status: statusDaOlaClick(o.status, entrega, o.delivery_status),
    telefone: telefoneDe(cliente?.phone_number, cliente?.country_calling_code),
    nome: texto(cliente?.name) || null,
    entrega,
    endereco: entrega === 'entrega' ? enderecoDe(o.address as Endereco | null) : null,
    totalCentavos: centavos(o.total),
    itens: itens
      .filter((i) => !texto(i.canceled_at))
      .map((i) => {
        const produto = texto(i.product_name)
        const variante = texto(i.variant_name)
        return {
          nome: variante && variante !== produto ? `${produto} (${variante})` : produto,
          quantidade: typeof i.quantity === 'number' ? i.quantity : 1,
          precoCentavos: centavos(i.combo_price),
        }
      }),
    rastreioUrl: null,
  }
}

/**
 * A entrega do webhook é da OlaClick? HMAC-SHA256 do corpo cru com o
 * `signing_secret`, no formato `sha256=<hex>`. Sem segredo, recusa.
 */
export function assinaturaDaOlaClick(corpoCru: string, segredo: string | null, cabecalho: string | null): boolean {
  if (!segredo || !cabecalho) return false
  const esperado = Buffer.from(`sha256=${createHmac('sha256', segredo).update(corpoCru).digest('hex')}`)
  const recebido = Buffer.from(cabecalho)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

/** `YYYY-MM-DD` em Brasília: é o formato dos filtros de data da OlaClick. */
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

type Chamada = { metodo?: 'GET' | 'POST' | 'DELETE'; corpo?: unknown; semPermissao?: string }

async function chamar(chave: string, caminho: string, buscar: Buscar, chamada: Chamada = {}): Promise<ResultadoDaLoja<unknown>> {
  try {
    const r = await buscar(`${ENDERECO_DA_OLACLICK}${caminho}`, {
      method: chamada.metodo ?? 'GET',
      headers: {
        Authorization: `Bearer ${chave}`,
        Accept: 'application/json',
        ...(chamada.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: chamada.corpo === undefined ? undefined : JSON.stringify(chamada.corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (r.status === 401) return { ok: false, motivo: 'A OlaClick recusou a chave de API.' }
    if (r.status === 403) return { ok: false, motivo: chamada.semPermissao ?? 'A chave da OlaClick não tem a permissão necessária.' }
    if (r.status === 404) return { ok: true, valor: null }
    if (r.status === 429) return { ok: false, motivo: 'A OlaClick pediu para esperar (limite de consultas).' }
    if (!r.ok) return { ok: false, motivo: `A OlaClick respondeu ${r.status}.` }
    if (r.status === 204) return { ok: true, valor: null }
    const corpo = (await r.json()) as { data?: unknown; pagination?: unknown }
    return { ok: true, valor: corpo }
  } catch {
    return { ok: false, motivo: 'A OlaClick não respondeu a tempo.' }
  }
}

const dados = (v: unknown): unknown => (v && typeof v === 'object' ? (v as { data?: unknown }).data : undefined)

/**
 * Testa a chave lendo os pedidos de hoje (`orders:read`, a única permissão
 * sem a qual nada funciona) e devolve o nome da loja, se a chave também ler a
 * empresa. Sem `companies:read`, conecta do mesmo jeito, sem nome.
 */
export async function lojaDaOlaClick(chave: string, buscar: Buscar = fetch): Promise<ResultadoDaLoja<{ nome: string }>> {
  const hoje = DIA.format(new Date())
  const pedidos = await chamar(chave, `/orders?filter[start_date]=${hoje}&filter[end_date]=${hoje}&per_page=1`, buscar, {
    semPermissao: 'A chave da OlaClick precisa da permissão de ler pedidos (orders:read).',
  })
  if (!pedidos.ok) return pedidos
  const empresa = await chamar(chave, '/company', buscar)
  const nome = empresa.ok ? texto((dados(empresa.valor) as { name?: unknown } | undefined)?.name) : ''
  return { ok: true, valor: { nome } }
}

/**
 * Registra o webhook da conta e devolve o id e o segredo de assinatura.
 * Antes, apaga o que já apontava para a mesma URL: conectar de novo (chave
 * trocada) não pode deixar a OlaClick entregando cada pedido duas vezes.
 */
export async function registrarWebhookDaOlaClick(
  chave: string,
  url: string,
  idDaConta: string,
  buscar: Buscar = fetch,
): Promise<ResultadoDaLoja<{ id: string; segredo: string }>> {
  const lista = await chamar(chave, '/webhooks', buscar)
  if (lista.ok) {
    const anteriores = dados(lista.valor)
    for (const w of Array.isArray(anteriores) ? (anteriores as { webhook_id?: unknown; webhook_url?: unknown }[]) : []) {
      if (texto(w.webhook_url) === url && texto(w.webhook_id)) await apagarWebhookDaOlaClick(chave, texto(w.webhook_id), buscar)
    }
  }
  const criado = await chamar(chave, '/webhooks', buscar, {
    metodo: 'POST',
    semPermissao: 'A chave não tem a permissão de webhooks (webhooks:write).',
    corpo: { webhook_url: url, merchant_id: idDaConta, event_types: ['ORDER_CREATED', 'ORDER_UPDATED'], max_retry: 10 },
  })
  if (!criado.ok) return criado
  const w = (dados(criado.valor) ?? {}) as { webhook_id?: unknown; signing_secret?: unknown }
  const id = texto(w.webhook_id)
  const segredo = texto(w.signing_secret)
  if (!id || !segredo) return { ok: false, motivo: 'A OlaClick não devolveu o webhook criado.' }
  return { ok: true, valor: { id, segredo } }
}

export async function apagarWebhookDaOlaClick(chave: string, id: string, buscar: Buscar = fetch): Promise<ResultadoDaLoja<null>> {
  if (!/^[\w-]{1,64}$/.test(id)) return { ok: true, valor: null }
  const r = await chamar(chave, `/webhooks/${id}`, buscar, { metodo: 'DELETE' })
  return r.ok ? { ok: true, valor: null } : r
}

type Resumo = { id?: unknown; updated_at?: unknown }

export function conectorOlaClick(chave: string, buscar: Buscar = fetch): ConectorDeCardapio {
  async function lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>> {
    if (!/^[\w-]{1,64}$/.test(idExterno)) return { ok: true, valor: null }
    const r = await chamar(chave, `/orders/${idExterno}`, buscar)
    return r.ok ? { ok: true, valor: traduzirPedido(dados(r.valor)) } : r
  }

  return {
    async lerCatalogo() {
      return { ok: false, motivo: 'O catálogo da OlaClick ainda não é importado.' }
    },

    lerPedido,

    /**
     * O filtro da OlaClick é por dia, no fuso da loja. Lê do dia de `desde`
     * (com 3 horas de folga para fuso e virada de dia) até hoje, pela data de
     * atualização, e só busca completo o que mudou depois de `desde`.
     */
    async pedidosDesde(desde) {
      const agora = Date.now()
      const de = DIA.format(new Date(desde.getTime() - 3 * 3_600_000))
      const ate = DIA.format(new Date(agora + 3 * 3_600_000))
      const filtro = `filter[start_date]=${de}&filter[end_date]=${ate}&filter[time_type]=updated_at&filter[service_types]=DELIVERY,TAKEAWAY,ONSITE&per_page=50`
      const mudados: string[] = []
      for (let pagina = 1; pagina <= PAGINAS_POR_PASSADA; pagina++) {
        const r = await chamar(chave, `/orders?${filtro}&page=${pagina}`, buscar)
        if (!r.ok) return r
        const lista = dados(r.valor)
        for (const resumo of Array.isArray(lista) ? (lista as Resumo[]) : []) {
          const quando = Date.parse(texto(resumo.updated_at))
          if (texto(resumo.id) && (Number.isNaN(quando) || quando >= desde.getTime())) mudados.push(texto(resumo.id))
        }
        const paginacao = (r.valor as { pagination?: { has_more?: unknown } } | null)?.pagination
        if (paginacao?.has_more !== true) break
      }
      const pedidos: PedidoDeFora[] = []
      for (const id of mudados.slice(0, PEDIDOS_POR_PASSADA)) {
        const lido = await lerPedido(id)
        if (!lido.ok) return lido
        if (lido.valor) pedidos.push(lido.valor)
      }
      return { ok: true, valor: pedidos }
    },
  }
}
