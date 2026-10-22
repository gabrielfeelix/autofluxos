import { describe, expect, it } from 'vitest'
import { analisarPedidos, type PedidoParaAnalise } from './analise-de-pedidos'

const pedido = (p: Partial<PedidoParaAnalise>): PedidoParaAnalise => ({
  status: 'entregue',
  entrega: 'entrega',
  totalCentavos: 5000,
  // Quarta, 21/out/2026, 19h em Brasília.
  criadoEm: '2026-10-21T22:00:00Z',
  emPreparoEm: null,
  saiuEm: null,
  entregueEm: null,
  ...p,
})

describe('análise dos pedidos', () => {
  it('ticket só dos que andaram; novo espera e cancelado não soma', () => {
    const r = analisarPedidos([
      pedido({ totalCentavos: 4000 }),
      pedido({ status: 'pago', totalCentavos: 6000 }),
      pedido({ status: 'novo', totalCentavos: 9900 }),
      pedido({ status: 'cancelado', totalCentavos: 9900 }),
    ])
    expect(r.vendidos).toBe(2)
    expect(r.aguardando).toBe(1)
    expect(r.cancelados).toBe(1)
    expect(r.faturadoCentavos).toBe(10000)
    expect(r.ticketMedioCentavos).toBe(5000)
    expect(r.taxaDeCancelamento).toBeCloseTo(1 / 3)
  })

  it('preparo e entrega pelas colunas de data; entrega só nos de entrega', () => {
    const r = analisarPedidos([
      pedido({ emPreparoEm: '2026-10-21T22:00:00Z', saiuEm: '2026-10-21T22:20:00Z', entregueEm: '2026-10-21T22:50:00Z' }),
      pedido({ entrega: 'retirada', emPreparoEm: '2026-10-21T22:00:00Z', saiuEm: '2026-10-21T22:10:00Z', entregueEm: '2026-10-21T23:30:00Z' }),
    ])
    expect(r.segundosDePreparo).toBe(15 * 60)
    expect(r.segundosDeEntrega).toBe(30 * 60)
    expect(r.porEntrega).toEqual({ entrega: 1, retirada: 1, local: 0 })
  })

  it('o horário é o de Brasília, com a segunda na linha 0', () => {
    const r = analisarPedidos([pedido({})])
    expect(r.horarios[2]![19]).toBe(1)
  })

  it('sem pedido, sem número inventado', () => {
    const r = analisarPedidos([])
    expect(r.ticketMedioCentavos).toBeNull()
    expect(r.taxaDeCancelamento).toBeNull()
    expect(r.segundosDePreparo).toBeNull()
  })
})
