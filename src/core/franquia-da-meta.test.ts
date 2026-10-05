import { describe, expect, it } from 'vitest'
import { emReais, franquiaDoMes, gastoDoPeriodo, lerPontosDaMeta, type PontoDaMeta } from './franquia-da-meta'

const p = (dia: string, volume: number, categoria = 'SERVICE', tipo = 'REGULAR'): PontoDaMeta => ({
  telefone: '5511999990000',
  dia,
  categoria,
  tipo,
  volume,
  custo: 0,
})

describe('lerPontosDaMeta', () => {
  it('lê o formato do pricing_analytics e põe o dia em São Paulo', () => {
    const pontos = lerPontosDaMeta({
      pricing_analytics: {
        data: [
          {
            data_points: [
              // 2026-09-24T03:00:00Z = meia-noite de 24/set em São Paulo
              { start: 1790218800, end: 1790305200, phone_number: '554474007438', pricing_type: 'FREE_CUSTOMER_SERVICE', pricing_category: 'SERVICE', volume: 7, cost: 0 },
              { start: 'x', phone_number: '5544', volume: 1 },
            ],
          },
        ],
      },
    })
    expect(pontos).toEqual([
      { telefone: '554474007438', dia: '2026-09-24', categoria: 'SERVICE', tipo: 'FREE_CUSTOMER_SERVICE', volume: 7, custo: 0 },
    ])
  })

  it('resposta sem dado vira lista vazia', () => {
    expect(lerPontosDaMeta({ id: '1' })).toEqual([])
    expect(lerPontosDaMeta(null)).toEqual([])
  })
})

describe('franquiaDoMes', () => {
  it('conta só serviço do mês, fora a janela de anúncio, e cobra o que passa de 1.000', () => {
    const [n] = franquiaDoMes(
      [
        p('2026-10-01', 900),
        p('2026-10-15', 150),
        p('2026-10-16', 40, 'SERVICE', 'FREE_ENTRY_POINT'),
        p('2026-10-16', 30, 'UTILITY'),
        p('2026-09-30', 500),
      ],
      '2026-10-01',
    )
    expect(n).toMatchObject({ usadas: 1050, restantes: 0, excedentes: 50, custoEstimado: 1.75, nivel: 'estourou', valendo: true })
  })

  it('antes de outubro mostra o uso sem cobrar', () => {
    const [n] = franquiaDoMes([p('2026-09-10', 850)], '2026-09-01')
    expect(n).toMatchObject({ usadas: 850, excedentes: 0, custoEstimado: 0, nivel: 'perto', valendo: false })
  })
})

describe('gastoDoPeriodo', () => {
  const ponto = (dia: string, categoria: string, tipo: string, volume: number): PontoDaMeta => ({
    telefone: '5544999990000',
    dia,
    categoria,
    tipo,
    volume,
    custo: null,
  })

  it('cobra modelo de marketing e utilidade pela tarifa, desde o primeiro', () => {
    const g = gastoDoPeriodo(
      [ponto('2026-10-03', 'MARKETING', 'REGULAR', 10), ponto('2026-10-03', 'UTILITY', 'REGULAR', 100)],
      '2026-10-01',
      '2026-10-31',
    )
    expect(g.porTipo).toEqual([
      { categoria: 'UTILITY', cobradas: 100, custo: 3.5 },
      { categoria: 'MARKETING', cobradas: 10, custo: 3.22 },
    ])
    expect(g.total).toBe(6.72)
  })

  it('serviço só paga o que passa das 1.000 do mês, contando dias fora do período', () => {
    const g = gastoDoPeriodo(
      [ponto('2026-10-02', 'SERVICE', 'FREE_TIER', 900), ponto('2026-10-20', 'SERVICE', 'REGULAR', 300)],
      '2026-10-15',
      '2026-10-31',
    )
    expect(g.servicoGratis).toBe(100)
    expect(g.porTipo).toEqual([{ categoria: 'SERVICE', cobradas: 200, custo: 7 }])
  })

  it('janela grátis da Meta não entra na conta', () => {
    const g = gastoDoPeriodo(
      [ponto('2026-10-03', 'MARKETING', 'FREE_ENTRY_POINT', 50), ponto('2026-10-03', 'SERVICE', 'FREE_ENTRY_POINT', 50)],
      '2026-10-01',
      '2026-10-31',
    )
    expect(g.total).toBe(0)
  })
})

describe('emReais', () => {
  it('mostra três casas só quando o centavo tem fração', () => {
    expect(emReais(0.035)).toBe('R$ 0,035')
    expect(emReais(0.3217)).toBe('R$ 0,32')
    expect(emReais(12.4)).toBe('R$ 12,40')
  })
})
