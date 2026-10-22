import { FUSO_DOS_RELATORIOS } from './relatorios'
import type { StatusDePedido } from './pedidos'

/**
 * Os números dos pedidos de um período (0146), sem banco: Análise > Vendas,
 * nos ramos com Pedidos.
 *
 * **Vendido é o pedido que andou**: pago, em preparo, saiu ou entregue. O
 * novo ainda espera o Pix e fica de fora do ticket, contado à parte; pagar na
 * entrega pula o Pago e entra do mesmo jeito, porque já foi para a cozinha.
 * Cancelado nunca soma no dinheiro.
 *
 * Os tempos saem das colunas de data de cada etapa: preparo é de quando entrou
 * em preparo até sair; entrega, de sair até entregue, só nos de entrega.
 */

export type PedidoParaAnalise = {
  status: StatusDePedido
  entrega: 'entrega' | 'retirada' | 'local'
  totalCentavos: number
  criadoEm: string
  emPreparoEm: string | null
  saiuEm: string | null
  entregueEm: string | null
}

export type AnaliseDePedidos = {
  vendidos: number
  aguardando: number
  cancelados: number
  /** Dos que tiveram desfecho (vendido ou cancelado), quantos cancelaram. */
  taxaDeCancelamento: number | null
  faturadoCentavos: number
  ticketMedioCentavos: number | null
  segundosDePreparo: number | null
  segundosDeEntrega: number | null
  porEntrega: Record<PedidoParaAnalise['entrega'], number>
  /** `[dia][hora]`, segunda na linha 0, no horário de Brasília. Todos os pedidos, cancelados também: é quando a procura chega. */
  horarios: number[][]
}

const VENDIDOS: readonly StatusDePedido[] = ['pago', 'em_preparo', 'saiu', 'entregue']

const DIA_E_HORA = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_DOS_RELATORIOS,
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
})
const DIAS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function diaEHora(iso: string): [number, number] {
  const partes = DIA_E_HORA.formatToParts(new Date(iso))
  const dia = DIAS.indexOf(partes.find((p) => p.type === 'weekday')?.value ?? '')
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '0') % 24
  return [Math.max(0, dia), hora]
}

function mediaDeSegundos(pares: [string | null, string | null][]): number | null {
  const duracoes = pares.flatMap(([de, ate]) => {
    if (!de || !ate) return []
    const s = (new Date(ate).getTime() - new Date(de).getTime()) / 1000
    return s >= 0 ? [s] : []
  })
  return duracoes.length === 0 ? null : Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
}

export function analisarPedidos(pedidos: readonly PedidoParaAnalise[]): AnaliseDePedidos {
  const vendidos = pedidos.filter((p) => VENDIDOS.includes(p.status))
  const cancelados = pedidos.filter((p) => p.status === 'cancelado').length
  const faturado = vendidos.reduce((s, p) => s + p.totalCentavos, 0)
  const horarios = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const p of pedidos) {
    const [d, h] = diaEHora(p.criadoEm)
    horarios[d]![h]!++
  }
  const porEntrega = { entrega: 0, retirada: 0, local: 0 }
  for (const p of vendidos) porEntrega[p.entrega]++
  const comDesfecho = vendidos.length + cancelados
  return {
    vendidos: vendidos.length,
    aguardando: pedidos.filter((p) => p.status === 'novo').length,
    cancelados,
    taxaDeCancelamento: comDesfecho === 0 ? null : cancelados / comDesfecho,
    faturadoCentavos: faturado,
    ticketMedioCentavos: vendidos.length === 0 ? null : Math.round(faturado / vendidos.length),
    segundosDePreparo: mediaDeSegundos(vendidos.map((p) => [p.emPreparoEm, p.saiuEm])),
    segundosDeEntrega: mediaDeSegundos(vendidos.filter((p) => p.entrega === 'entrega').map((p) => [p.saiuEm, p.entregueEm])),
    porEntrega,
    horarios,
  }
}
