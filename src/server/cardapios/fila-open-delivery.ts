import 'server-only'
import type { ConectorOpenDelivery, EventoOpenDelivery } from '@/cardapios/opendelivery'
import { alertar } from '../alertar'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { marcarPedidosLidos, type CardapioConectado } from '../repos/cardapios'

const PEDIDOS_POR_PASSADA = 60

/**
 * A passada: lê a fila de eventos, relê cada pedido, grava e só então
 * confirma. Evento anterior à ligação, pedido sumido e pedido de mesa são
 * confirmados sem virar nada, para não travar a fila. Se a leitura de um
 * pedido falhar, o que sobrou fica na fila para a próxima volta.
 */
export async function passadaDaFila(
  cardapio: CardapioConectado,
  conector: ConectorOpenDelivery,
  nome: string,
  agora = new Date(),
): Promise<number> {
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const eventos = await conector.lerEventos()
  if (!eventos.ok) {
    await alertar(`A passada da ${nome} falhou`, eventos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }

  const porPedido = new Map<string, EventoOpenDelivery[]>()
  const aConfirmar: EventoOpenDelivery[] = []
  for (const evento of eventos.valor) {
    if (evento.criadoEm && evento.criadoEm < desde) {
      aConfirmar.push(evento)
      continue
    }
    porPedido.set(evento.pedidoId, [...(porPedido.get(evento.pedidoId) ?? []), evento])
  }

  let gravados = 0
  let parou = false
  for (const [pedidoId, doPedido] of [...porPedido].slice(0, PEDIDOS_POR_PASSADA)) {
    const lido = await conector.lerPedido(pedidoId)
    if (!lido.ok) {
      await alertar(`O pedido da ${nome} não foi lido`, lido.motivo, { clienteId: cardapio.clienteId, pedido: pedidoId })
      parou = true
      break
    }
    if (lido.valor) {
      await receberPedidoDeFora(cardapio.clienteId, lido.valor, { avisarCliente: cardapio.avisarCliente })
      gravados++
    }
    aConfirmar.push(...doPedido)
  }

  if (aConfirmar.length > 0) {
    const confirmado = await conector.confirmar(aConfirmar)
    if (!confirmado.ok) await alertar(`A ${nome} não aceitou a confirmação dos eventos`, confirmado.motivo, { clienteId: cardapio.clienteId })
  }
  // Volta interrompida não avança o relógio: o que ficou na fila seria tomado por antigo e confirmado sem gravar.
  if (!parou && porPedido.size <= PEDIDOS_POR_PASSADA) await marcarPedidosLidos(cardapio.id, agora)
  return gravados
}
