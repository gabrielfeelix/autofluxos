import { describe, expect, it } from 'vitest'
import { eventoDaEtapa, podeAvancar } from './pedidos-de-fora'

describe('pedido de fora', () => {
  it('a etapa só anda para a frente', () => {
    expect(podeAvancar('saiu', 'em_preparo')).toBe(false)
    expect(podeAvancar('em_preparo', 'saiu')).toBe(true)
    expect(podeAvancar('saiu', 'saiu')).toBe(false)
  })

  it('cancelar vale de qualquer etapa antes de entregue', () => {
    expect(podeAvancar('novo', 'cancelado')).toBe(true)
    expect(podeAvancar('saiu', 'cancelado')).toBe(true)
    expect(podeAvancar('entregue', 'cancelado')).toBe(false)
    expect(podeAvancar('cancelado', 'saiu')).toBe(false)
  })

  it('cada etapa abre o seu evento', () => {
    expect(eventoDaEtapa('saiu')).toBe('pedido.saiu')
    expect(eventoDaEtapa('em_preparo')).toBe('pedido.em_preparo')
  })
})
