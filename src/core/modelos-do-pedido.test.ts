import { describe, expect, it } from 'vitest'
import { MODELOS_DO_PEDIDO, modeloDaEtapa, valoresDoAviso } from './modelos-do-pedido'
import { validarTemplate } from './templates'

describe('modelos de aviso do pedido', () => {
  it('saiu vira entrega ou retirada conforme o pedido', () => {
    expect(modeloDaEtapa('saiu', 'entrega')?.nome).toBe('aviso_pedido_saiu_entrega')
    expect(modeloDaEtapa('saiu', 'retirada')?.nome).toBe('aviso_pedido_pronto_retirada')
    expect(modeloDaEtapa('saiu', 'local')?.nome).toBe('aviso_pedido_pronto_retirada')
  })

  it('preparo e cancelamento valem para qualquer entrega', () => {
    expect(modeloDaEtapa('em_preparo', 'retirada')?.nome).toBe('aviso_pedido_em_preparo')
    expect(modeloDaEtapa('cancelado', 'entrega')?.nome).toBe('aviso_pedido_cancelado')
  })

  it('etapa sem aviso não tem modelo', () => {
    expect(modeloDaEtapa('pago', 'entrega')).toBeNull()
    expect(modeloDaEtapa('novo', 'entrega')).toBeNull()
    expect(modeloDaEtapa('entregue', 'entrega')).toBeNull()
  })

  it('todo corpo passa na conferência da Meta como utilidade', () => {
    for (const m of MODELOS_DO_PEDIDO) {
      const erros = validarTemplate(m.nome, { corpo: m.corpo }, 'UTILITY').filter((r) => r.gravidade === 'erro')
      expect(erros, m.nome).toEqual([])
    }
  })

  it('os valores seguem a ordem do corpo: número e loja', () => {
    expect(valoresDoAviso('123', 'Pizzaria Bella')).toEqual(['123', 'Pizzaria Bella'])
    expect(valoresDoAviso('123', '  ')).toBeNull()
  })
})
