import { describe, expect, it } from 'vitest'
import { fimDoRastreio, MODELO_DE_RASTREIO, MODELOS_DO_PEDIDO, modeloDaEtapa, valoresDoAviso } from './modelos-do-pedido'
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

  it('o único valor é o número, sem o #, que já está no corpo', () => {
    expect(valoresDoAviso('1042')).toEqual(['1042'])
    expect(valoresDoAviso('#1042')).toEqual(['1042'])
    expect(valoresDoAviso('  ')).toBeNull()
  })

  it('o corpo não cita a loja: a mensagem já sai do número dela', () => {
    for (const m of MODELOS_DO_PEDIDO) {
      expect(m.corpo).toContain('#{{1}}')
      expect(m.corpo).not.toContain('{{2}}')
    }
  })

  it('o rastreio da Foody vira o fim do botão; link de outro lugar não', () => {
    expect(fimDoRastreio('https://app.foodydelivery.com/trk/58f37fe7-ddaf-46db-8918-e34d0b920062')).toBe(
      '58f37fe7-ddaf-46db-8918-e34d0b920062',
    )
    expect(fimDoRastreio('https://outro.com/trk/abc')).toBeNull()
    expect(fimDoRastreio('https://app.foodydelivery.com/trk/a/b')).toBeNull()
    expect(fimDoRastreio(null)).toBeNull()
  })

  it('o modelo de rastreio passa na validação, com o botão de link', () => {
    const m = MODELO_DE_RASTREIO
    const reparos = validarTemplate(m.nome, { corpo: m.corpo, botoes: [{ tipo: 'URL', texto: m.botao!.texto, valor: m.botao!.url }] }, 'UTILITY')
    expect(reparos.filter((r) => r.gravidade === 'erro')).toEqual([])
  })
})
