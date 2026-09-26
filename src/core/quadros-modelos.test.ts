import { describe, expect, it } from 'vitest'
import { LIMITE_DE_ETAPAS } from './quadros'
import { MODELOS_DE_QUADRO, etapasDoModelo, finalidadeDoModelo } from './quadros-modelos'

describe('os modelos de funil', () => {
  it('cabem na régua de etapas, e todo funil tem onde terminar bem', () => {
    for (const modelo of MODELOS_DE_QUADRO) {
      expect(modelo.etapas.length, modelo.id).toBeLessThanOrEqual(LIMITE_DE_ETAPAS)
      expect(modelo.etapas.length, modelo.id).toBeGreaterThanOrEqual(3)
      expect(modelo.etapas.filter((e) => e.tipo === 'ganho'), modelo.id).toHaveLength(1)
    }
  })

  it('toda etapa aberta tem prazo, que é o que acende o aviso de parado', () => {
    for (const modelo of MODELOS_DE_QUADRO) {
      for (const etapa of modelo.etapas.filter((e) => !e.tipo)) expect(etapa.dias, `${modelo.id}/${etapa.nome}`).toBeGreaterThan(0)
    }
  })

  it('ids e nomes de etapa não se repetem', () => {
    const ids = MODELOS_DE_QUADRO.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const modelo of MODELOS_DE_QUADRO) {
      const nomes = modelo.etapas.map((e) => e.nome)
      expect(new Set(nomes).size, modelo.id).toBe(nomes.length)
    }
  })
})

/*
 * O funil do restaurante (PLANO-NICHOS 4.5). Pedido entregue é venda feita,
 * então concluir pede o valor, como no Comercial.
 */
describe('o funil de pedidos', () => {
  it('vai do pedido que chegou até a entrega', () => {
    expect(etapasDoModelo('pedidos').map((e) => e.nome)).toEqual([
      'Novo pedido',
      'Em preparo',
      'Saiu para entrega',
      'Entregue',
      'Cancelado',
    ])
  })

  it('entregue é o ganho, cancelado é a perda, e o funil vende', () => {
    const etapas = etapasDoModelo('pedidos')
    expect(etapas.find((e) => e.tipo === 'ganho')?.nome).toBe('Entregue')
    expect(etapas.find((e) => e.tipo === 'perdido')?.nome).toBe('Cancelado')
    expect(finalidadeDoModelo('pedidos')).toBe('comercial')
  })
})
