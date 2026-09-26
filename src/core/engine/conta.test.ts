import { describe, expect, it } from 'vitest'
import { calcular, formatarConta, resultadoDaConta } from './conta'

describe('conta do carrinho', () => {
  it('soma, subtrai, multiplica e respeita os parênteses', () => {
    expect(calcular('0 + (52,90 + -8) * 2')).toBeCloseTo(89.8)
    expect(calcular('10 - 2 * 3')).toBe(4)
    expect(calcular('(10 - 2) * 3')).toBe(24)
    expect(calcular('100 / 4')).toBe(25)
  })

  it('lê vírgula e ponto como decimal, e milhar com vírgula', () => {
    expect(calcular('52,90')).toBeCloseTo(52.9)
    expect(calcular('52.90')).toBeCloseTo(52.9)
    expect(calcular('1.234,50 + 0,50')).toBeCloseTo(1235)
  })

  it('devolve com vírgula e duas casas, e a volta lê o que saiu', () => {
    expect(formatarConta(89.8)).toBe('89,80')
    expect(resultadoDaConta(`${resultadoDaConta('52,9 * 2')} + 6`)).toBe('111,80')
  })

  it('texto que não é conta guarda vazio, sem inventar', () => {
    expect(resultadoDaConta('')).toBe('')
    expect(resultadoDaConta(' + 6')).toBe('')
    expect(resultadoDaConta('abc + 1')).toBe('')
    expect(resultadoDaConta('2 ** 3')).toBe('')
    expect(resultadoDaConta('(1 + 2')).toBe('')
    expect(resultadoDaConta('1 / 0')).toBe('')
    expect(resultadoDaConta('process.exit()')).toBe('')
  })
})
