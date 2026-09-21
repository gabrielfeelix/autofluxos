import { describe, expect, it } from 'vitest'
import {
  acaoAoFechar,
  comoLerGanhoLegado,
  contaComoCompra,
  ehFinalidade,
  FINALIDADE_PADRAO,
  situacaoCabeNaFinalidade,
} from './oportunidades'

/**
 * A separação que esta fase existe para fazer: **sucesso não é venda**.
 *
 * O aceite A11 em forma de teste puro. Cada caso abaixo é um desfecho real que
 * hoje vira compra no `repos/crm.ts` por ser `situacao = 'ganha'`.
 */

describe('finalidade do processo', () => {
  /**
   * Processo sem classificação não pode produzir receita. O desconhecido segue
   * o caminho seguro (RB-06), e o caminho seguro aqui é não vender.
   */
  it('o padrão de quem não escolheu é operacional', () => {
    expect(FINALIDADE_PADRAO).toBe('operacional')
    expect(contaComoCompra('ganha', FINALIDADE_PADRAO)).toBe(false)
  })

  it('reconhece só as finalidades conhecidas', () => {
    expect(ehFinalidade('comercial')).toBe(true)
    expect(ehFinalidade('operacional')).toBe(true)
    expect(ehFinalidade('vendas')).toBe(false)
    expect(ehFinalidade(null)).toBe(false)
  })
})

describe('o que conta como compra (A11)', () => {
  /** O caso do enunciado: atendimento resolvido, agendamento cumprido. */
  it('sucesso operacional nunca é compra', () => {
    expect(contaComoCompra('concluida', 'operacional')).toBe(false)
    expect(contaComoCompra('ganha', 'operacional')).toBe(false)
  })

  it('ganho em processo comercial é o único que pode contar', () => {
    expect(contaComoCompra('ganha', 'comercial')).toBe(true)
    expect(contaComoCompra('perdida', 'comercial')).toBe(false)
    expect(contaComoCompra('concluida', 'comercial')).toBe(false)
    expect(contaComoCompra('cancelada', 'comercial')).toBe(false)
    expect(contaComoCompra('aberta', 'comercial')).toBe(false)
  })
})

describe('vocabulário por finalidade', () => {
  /**
   * RB-23: Ganhar/Perder são rótulos da oportunidade comercial. Um quadro de
   * atendimento não "ganha" ninguém.
   */
  it('ganha e perdida só existem em processo comercial', () => {
    expect(situacaoCabeNaFinalidade('ganha', 'comercial')).toBe(true)
    expect(situacaoCabeNaFinalidade('perdida', 'comercial')).toBe(true)
    expect(situacaoCabeNaFinalidade('ganha', 'operacional')).toBe(false)
    expect(situacaoCabeNaFinalidade('perdida', 'operacional')).toBe(false)
  })

  it('concluir e cancelar valem para os dois', () => {
    for (const finalidade of ['comercial', 'operacional'] as const) {
      expect(situacaoCabeNaFinalidade('concluida', finalidade)).toBe(true)
      expect(situacaoCabeNaFinalidade('cancelada', finalidade)).toBe(true)
    }
  })
})

describe('o que abre ao arrastar para a etapa final', () => {
  /** RB-23: em comercial, a etapa de ganho pede a venda antes de fechar. */
  it('comercial pede registrar venda, e não fecha sozinho', () => {
    expect(acaoAoFechar('ganho', 'comercial')).toEqual({ tipo: 'registrar-venda' })
    expect(acaoAoFechar('perdido', 'comercial')).toEqual({ tipo: 'marcar-perdida' })
  })

  it('operacional conclui, sem pedir venda nenhuma', () => {
    expect(acaoAoFechar('ganho', 'operacional')).toEqual({ tipo: 'concluir' })
    expect(acaoAoFechar('perdido', 'operacional')).toEqual({ tipo: 'cancelar' })
  })

  /** Arrastar entre etapas comuns não abre formulário nenhum. */
  it('etapa normal não abre nada', () => {
    expect(acaoAoFechar('normal', 'comercial')).toBeNull()
    expect(acaoAoFechar('normal', 'operacional')).toBeNull()
  })
})

describe('como ler o ganho antigo (RB-32)', () => {
  /**
   * A migração não pode decidir sozinha que um ganho velho foi venda. Em
   * processo operacional ele é conclusão e acabou; em comercial, espera revisão
   * humana, "nome do quadro, etiqueta e valor positivo isolados não são prova".
   */
  it('ganho operacional antigo é conclusão, não venda', () => {
    expect(comoLerGanhoLegado('operacional')).toBe('conclusao')
  })

  it('ganho comercial antigo fica pendente de revisão, sem virar venda', () => {
    expect(comoLerGanhoLegado('comercial')).toBe('venda-pendente-de-revisao')
  })
})
