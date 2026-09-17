import { describe, expect, it } from 'vitest'
import { comoVai, NPS_VAZIO, resumirNps } from './nps'

const em = (nota: number) => ({ nota, criadaEm: '2026-09-16T12:00:00Z' })

describe('resumirNps', () => {
  it('sem nota nenhuma devolve o vazio, e não uma divisão por zero', () => {
    expect(resumirNps([])).toEqual(NPS_VAZIO)
  })

  it('separa as faixas pela mesma régua do motor', () => {
    // 9 e 10 promovem, 7 e 8 são neutros, 0 a 6 detratam.
    const r = resumirNps([em(10), em(9), em(8), em(7), em(6), em(0)])
    expect(r.promotores).toBe(2)
    expect(r.neutros).toBe(2)
    expect(r.detratores).toBe(2)
    expect(r.total).toBe(6)
  })

  it('o neutro conta no total e não no cálculo', () => {
    // Dez notas 8 dão zero ponto, e zero aqui não é "ninguém respondeu".
    const so8 = resumirNps(Array.from({ length: 10 }, () => em(8)))
    expect(so8.pontos).toBe(0)
    expect(so8.total).toBe(10)
    expect(so8).not.toEqual(NPS_VAZIO)
  })

  it('promotor puro dá 100 e detrator puro dá -100', () => {
    expect(resumirNps([em(10), em(9)]).pontos).toBe(100)
    expect(resumirNps([em(0), em(6)]).pontos).toBe(-100)
  })

  it('arredonda os pontos para inteiro', () => {
    // 2 de 3 promotores, 1 detrator: (2-1)/3 = 33,33…
    expect(resumirNps([em(10), em(10), em(3)]).pontos).toBe(33)
  })

  it('a média vai a uma casa', () => {
    expect(resumirNps([em(10), em(9), em(8)]).media).toBe(9)
    expect(resumirNps([em(10), em(9)]).media).toBe(9.5)
    expect(resumirNps([em(10), em(9), em(7)]).media).toBe(8.7)
  })
})

describe('comoVai', () => {
  it('traduz a faixa em uma palavra', () => {
    expect(comoVai(-1)).toBe('crítico')
    expect(comoVai(0)).toBe('razoável')
    expect(comoVai(49)).toBe('razoável')
    expect(comoVai(50)).toBe('bom')
    expect(comoVai(74)).toBe('bom')
    expect(comoVai(75)).toBe('excelente')
    expect(comoVai(100)).toBe('excelente')
  })
})
