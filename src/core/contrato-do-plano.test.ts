import { describe, expect, it } from 'vitest'
import { avisoDaDescida, diasAte, excedente, faixaDoConsumo, fraseDoExcedente, proximaVirada, reais, somarDias } from './contrato-do-plano'
import { idDoNome, ehIdDePlano } from './planos'

describe('contrato do plano', () => {
  it('a virada é o primeiro dia do mês seguinte, no fuso de São Paulo', () => {
    expect(proximaVirada(new Date('2026-09-24T15:00:00Z'))).toBe('2026-10-01')
    expect(proximaVirada(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01-01')
    // 1º/out 01:00 UTC ainda é 30/set em São Paulo
    expect(proximaVirada(new Date('2026-10-01T01:00:00Z'))).toBe('2026-10-01')
  })

  it('conta os dias até a virada', () => {
    expect(diasAte('2026-10-01', new Date('2026-09-24T15:00:00Z'))).toBe(7)
    expect(somarDias('2026-09-24', 30)).toBe('2026-10-24')
  })

  it('o excedente é o que passou vezes o preço por conversa', () => {
    const e = excedente(3000, { conversas: 1000, precoExcedente: 0.4 })
    expect(e).toEqual({ conversas: 2000, precoPorConversa: 0.4, valor: 800 })
    expect(fraseDoExcedente(e)).toBe('Passou 2.000 conversas; a R$ 0,40 cada, são R$ 800 a mais neste mês.')
    expect(excedente(900, { conversas: 1000, precoExcedente: 0.4 }).valor).toBe(0)
    expect(fraseDoExcedente(excedente(900, { conversas: 1000, precoExcedente: 0.4 }))).toBeNull()
  })

  it('avisa em 80% e 100% da faixa', () => {
    expect(faixaDoConsumo(799, 1000)).toBeNull()
    expect(faixaDoConsumo(800, 1000)).toBe(80)
    expect(faixaDoConsumo(1000, 1000)).toBe(100)
    expect(faixaDoConsumo(10, 0)).toBeNull()
  })

  it('o aviso da descida sai 7 dias e 1 dia antes', () => {
    expect(avisoDaDescida('2026-10-01', new Date('2026-09-20T15:00:00Z'))).toBeNull()
    expect(avisoDaDescida('2026-10-01', new Date('2026-09-24T15:00:00Z'))).toBe(7)
    expect(avisoDaDescida('2026-10-01', new Date('2026-09-28T15:00:00Z'))).toBe(7)
    expect(avisoDaDescida('2026-10-01', new Date('2026-09-30T15:00:00Z'))).toBe(1)
    expect(avisoDaDescida('2026-10-01', new Date('2026-10-01T15:00:00Z'))).toBeNull()
  })

  it('escreve reais com centavos só quando há centavos', () => {
    expect(reais(0.4)).toBe('R$ 0,40')
    expect(reais(1097)).toBe('R$ 1.097')
  })

  it('o id do plano nasce do nome', () => {
    expect(idDoNome('Operação Plus')).toBe('operacao-plus')
    expect(ehIdDePlano(idDoNome('  Escala 2!  '))).toBe(true)
    expect(ehIdDePlano('')).toBe(false)
  })
})
