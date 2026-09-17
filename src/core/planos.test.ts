import { describe, expect, it } from 'vitest'

import {
  PLANOS,
  PLANO_DE_ENTRADA,
  PLANO_EM_DESTAQUE,
  acharPlano,
  fracaoUsada,
} from './planos'

describe('a tabela de planos', () => {
  it('tem as três faixas decididas, com preço e conversa crescentes', () => {
    expect(PLANOS.map((p) => p.id)).toEqual(['essencial', 'operacao', 'escala'])
    expect(PLANOS.map((p) => p.preco)).toEqual([297, 597, 1197])
    expect(PLANOS.map((p) => p.conversas)).toEqual([1000, 3000, 8000])
  })

  /*
   * Não é firula: uma faixa mais cara que comporta menos conversa é a tabela
   * dizendo ao cliente que subir de plano piora a vida dele, e é o tipo de erro
   * que passa por revisão porque cada linha, sozinha, parece certa.
   */
  it('nunca cobra mais por menos', () => {
    const precos = PLANOS.map((p) => p.preco)
    const conversas = PLANOS.map((p) => p.conversas)
    expect(precos).toEqual([...precos].sort((a, b) => a - b))
    expect(conversas).toEqual([...conversas].sort((a, b) => a - b))
    expect(new Set(precos).size).toBe(precos.length)
    expect(new Set(conversas).size).toBe(conversas.length)
  })

  it('promete atendente ilimitado nos três, que é a decisão de 16/set', () => {
    for (const plano of PLANOS) {
      expect(plano.itens).toContain('Atendentes ilimitados')
    }
  })

  /*
   * O card diz a franquia na primeira linha porque a unidade da cobrança é
   * conversa, e o cliente precisa saber o que está comprando antes de ler o
   * resto da lista. Se o número da lista divergir do campo, a tela mente.
   */
  it('abre a lista com a franquia, e ela bate com o campo', () => {
    for (const plano of PLANOS) {
      expect(plano.itens[0]).toBe(
        `Até ${plano.conversas.toLocaleString('pt-BR')} conversas por mês`,
      )
    }
  })

  it('aponta o plano de entrada e o destaque para faixas que existem', () => {
    expect(PLANOS.some((p) => p.id === PLANO_DE_ENTRADA)).toBe(true)
    expect(PLANOS.some((p) => p.id === PLANO_EM_DESTAQUE)).toBe(true)
  })
})

describe('acharPlano', () => {
  it('acha cada faixa pelo id', () => {
    expect(acharPlano('operacao').preco).toBe(597)
    expect(acharPlano('escala').nome).toBe('Escala')
  })

  /*
   * Uma conta com plano desconhecido no banco precisa continuar abrindo o
   * painel. Errar para o plano mais barato é o lado seguro de errar.
   */
  it('cai no plano de entrada quando o id não existe', () => {
    expect(acharPlano('inventado' as never).id).toBe(PLANO_DE_ENTRADA)
  })
})

describe('fracaoUsada', () => {
  it('mede o consumo contra a faixa do plano', () => {
    const essencial = acharPlano('essencial')
    expect(fracaoUsada(0, essencial)).toBe(0)
    expect(fracaoUsada(500, essencial)).toBe(0.5)
    expect(fracaoUsada(1000, essencial)).toBe(1)
  })

  it('passa de 1 quando a conta estourou, porque quem estourou precisa ver', () => {
    expect(fracaoUsada(1500, acharPlano('essencial'))).toBe(1.5)
  })
})
