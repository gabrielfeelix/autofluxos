import { describe, expect, it } from 'vitest'
import { franquiaDoMes, lerPontosDaMeta, type PontoDaMeta } from './franquia-da-meta'

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
