import 'server-only'
import {
  dadosDoPedido,
  eventoDoStatus,
  formatoDaLoja,
  instanteDaLoja,
  telefoneDoPedido,
  type PedidoLido,
} from '@/core/eventos-da-loja'
import { alertar } from './alertar'
import { chamarHttp } from './efeitos/http'
import { tratarEvento } from './receber-evento'
import { lerCredencial } from './repos/conexoes'
import {
  lojasComPedidosAcompanhados,
  marcarPedidosLidos,
  marcarStatusAvisado,
  type LojaIntegrada,
} from './repos/lojas'
import { listarGatilhosDeEvento } from './repos/webhooks-de-entrada'

/**
 * A passada que transforma mudança de status de pedido em evento (0153), ver
 * `core/eventos-da-loja.ts`. Roda a cada 10 minutos pela rota
 * `/api/manutencao/pedidos`, chamada pelo GitHub Actions (a Vercel Hobby só
 * agenda uma vez por dia; ver docs/DECISIONS.md, 26/out/2026).
 *
 * Por conta: lê os pedidos atualizados desde a última leitura, e cada pedido
 * cujo status tem gatilho ligado vira `tratarEvento`, o mesmo caminho do
 * webhook de entrada. O par pedido + status avisa uma vez só.
 */

/** Pedidos lidos por conta e por passada. O resto fica para a próxima. */
const POR_PASSADA = 50

const CAMPOS =
  'items[increment_id,status,updated_at,customer_id,customer_firstname,customer_lastname,customer_email,grand_total,billing_address[telephone,firstname,lastname],extension_attributes]'

export async function acompanharPedidos(): Promise<{ contas: number; eventos: number }> {
  const lojas = await lojasComPedidosAcompanhados()
  let eventos = 0
  for (const loja of lojas) {
    // Uma loja fora do ar não pode calar as outras.
    eventos += await passadaDaLoja(loja).catch(async (erro) => {
      await alertar('a leitura dos pedidos da loja falhou', erro, { cliente: loja.clienteId })
      return 0
    })
  }
  return { contas: lojas.length, eventos }
}

async function passadaDaLoja(loja: LojaIntegrada & { pedidosLidosAte: string }): Promise<number> {
  // Sem gatilho ligado para algum status, não há por que ler a loja.
  const eventosLigados = new Set(
    (await listarGatilhosDeEvento(loja.clienteId)).filter((g) => g.ativo && g.evento.startsWith('pedido.')).map((g) => g.evento),
  )
  if (eventosLigados.size === 0) return 0

  const credencial = loja.conexaoId ? await lerCredencial(loja.conexaoId, loja.clienteId) : null
  if (!credencial) {
    await alertar('a loja acompanha pedidos e está sem token', 'conecte o token da Magento de novo', { cliente: loja.clienteId })
    return 0
  }

  const desde = formatoDaLoja(new Date(loja.pedidosLidosAte))
  const f = 'searchCriteria[filterGroups][0][filters][0]'
  const consulta =
    `${f}[field]=updated_at&${f}[value]=${encodeURIComponent(desde)}&${f}[conditionType]=gteq` +
    `&searchCriteria[sortOrders][0][field]=updated_at&searchCriteria[sortOrders][0][direction]=ASC` +
    `&searchCriteria[pageSize]=${POR_PASSADA}&fields=${encodeURIComponent(CAMPOS)}`
  const r = await chamarHttp(
    {
      tipo: 'chamar_http',
      metodo: 'GET',
      url: `${loja.endereco.replace(/\/+$/, '')}/rest/V1/orders?${consulta}`,
      cabecalhos: [],
      corpo: '',
      mapear: [],
      aoFalhar: 'humano',
    },
    { deTeste: false, credencial, comJson: true },
  )
  if (!r.ok) throw new Error(r.motivo)
  const pedidos = (r.json as { items?: PedidoLido[] } | null)?.items ?? []

  let eventos = 0
  let lidoAte: Date | null = null
  for (const pedido of pedidos) {
    const quando = instanteDaLoja(pedido.updated_at)
    if (quando && (!lidoAte || quando > lidoAte)) lidoAte = quando

    const status = typeof pedido.status === 'string' ? pedido.status : ''
    const evento = eventoDoStatus(status)
    const numero = typeof pedido.increment_id === 'string' || typeof pedido.increment_id === 'number' ? String(pedido.increment_id) : ''
    if (!evento || !numero || !eventosLigados.has(evento)) continue
    if (!(await marcarStatusAvisado(loja.clienteId, numero, status))) continue

    const telefone = telefoneDoPedido(pedido)
    if (!telefone) {
      await alertar('pedido sem telefone não virou evento', `${evento} do pedido ${numero}`, { cliente: loja.clienteId })
      continue
    }
    await tratarEvento({ clienteId: loja.clienteId, evento, telefone, dados: dadosDoPedido(pedido) })
    eventos++
  }

  if (lidoAte) await marcarPedidosLidos(loja.id, lidoAte.toISOString())
  return eventos
}
