import { describe, expect, it } from 'vitest'
import { eventoDaEtapa, podeAvancar, telefoneDoPedido } from './pedidos-de-fora'

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

  it('telefone de central não vira contato', () => {
    expect(telefoneDoPedido('0800 705 0505')).toBeNull()
    expect(telefoneDoPedido('4004-0000')).toBeNull()
    expect(telefoneDoPedido(null)).toBeNull()
    expect(telefoneDoPedido('  ')).toBeNull()
  })

  it('celular com DDD vira a forma canônica', () => {
    expect(telefoneDoPedido('(44) 99876-5432')).toBe('5544998765432')
    expect(telefoneDoPedido('+55 44 99876-5432')).toBe('5544998765432')
  })
})
