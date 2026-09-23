import { describe, expect, it } from 'vitest'
import {
  completarDias,
  diasEntre,
  ehDiaValido,
  hojeEmSaoPaulo,
  lerPeriodo,
  periodoAnterior,
  variacao,
} from './relatorios'

const HOJE = '2026-09-23'

describe('lerPeriodo', () => {
  it('sem parâmetro são os últimos 30 dias, hoje incluído', () => {
    expect(lerPeriodo({}, HOJE)).toEqual({ de: '2026-08-25', ate: HOJE, dias: 30, atalho: 30 })
  })

  it('atalho de 7 dias', () => {
    expect(lerPeriodo({ dias: '7' }, HOJE)).toEqual({ de: '2026-09-17', ate: HOJE, dias: 7, atalho: 7 })
  })

  it('atalho desconhecido cai nos 30', () => {
    expect(lerPeriodo({ dias: '12' }, HOJE).atalho).toBe(30)
  })

  it('intervalo à mão vira personalizado', () => {
    expect(lerPeriodo({ de: '2026-09-01', ate: '2026-09-10' }, HOJE)).toEqual({
      de: '2026-09-01',
      ate: '2026-09-10',
      dias: 10,
      atalho: null,
    })
  })

  it('intervalo à mão do tamanho de um atalho, terminando hoje, acende o atalho', () => {
    expect(lerPeriodo({ de: '2026-09-17', ate: HOJE }, HOJE).atalho).toBe(7)
  })

  it('futuro é cortado em hoje', () => {
    expect(lerPeriodo({ de: '2026-09-20', ate: '2026-10-05' }, HOJE)).toMatchObject({ ate: HOJE, dias: 4 })
  })

  it('início depois do fim, ou data que não existe, volta ao padrão', () => {
    expect(lerPeriodo({ de: '2026-09-10', ate: '2026-09-01' }, HOJE).dias).toBe(30)
    expect(lerPeriodo({ de: '2026-02-30', ate: '2026-03-02' }, HOJE).dias).toBe(30)
  })

  it('mais de um ano é cortado em 366 dias, contando do fim', () => {
    const p = lerPeriodo({ de: '2020-01-01', ate: HOJE }, HOJE)
    expect(p.dias).toBe(366)
    expect(p.ate).toBe(HOJE)
  })
})

describe('periodoAnterior', () => {
  it('é do mesmo tamanho e termina na véspera do início', () => {
    expect(periodoAnterior(lerPeriodo({ dias: '7' }, HOJE))).toEqual({
      de: '2026-09-10',
      ate: '2026-09-16',
      dias: 7,
      atalho: null,
    })
  })

  it('atravessa virada de mês e de ano', () => {
    const p = periodoAnterior({ de: '2026-01-01', ate: '2026-01-31', dias: 31, atalho: null })
    expect(p).toMatchObject({ de: '2025-12-01', ate: '2025-12-31' })
  })
})

describe('completarDias', () => {
  const vazio = (dia: string) => ({ dia, n: 0 })

  it('preenche os dias sem movimento com zero, em ordem', () => {
    const serie = completarDias([{ dia: '2026-09-03', n: 5 }, { dia: '2026-09-01', n: 2 }], '2026-09-01', '2026-09-04', vazio)
    expect(serie).toEqual([
      { dia: '2026-09-01', n: 2 },
      { dia: '2026-09-02', n: 0 },
      { dia: '2026-09-03', n: 5 },
      { dia: '2026-09-04', n: 0 },
    ])
  })

  it('série vazia vira um zero por dia', () => {
    expect(completarDias([], '2026-02-27', '2026-03-01', vazio).map((d) => d.dia)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ])
  })

  it('descarta dia fora do período', () => {
    const serie = completarDias([{ dia: '2026-08-31', n: 9 }], '2026-09-01', '2026-09-01', vazio)
    expect(serie).toEqual([{ dia: '2026-09-01', n: 0 }])
  })
})

describe('variacao', () => {
  it('sem base quando o anterior é zero ou não existe', () => {
    expect(variacao(10, 0)).toEqual({ tipo: 'sem-base' })
    expect(variacao(null, 4)).toEqual({ tipo: 'sem-base' })
  })

  it('subiu e caiu, arredondado', () => {
    expect(variacao(15, 10)).toEqual({ tipo: 'subiu', percentual: 50 })
    expect(variacao(2, 3)).toEqual({ tipo: 'caiu', percentual: 33 })
  })

  it('igual quando não muda, ou muda menos que meio por cento', () => {
    expect(variacao(7, 7)).toEqual({ tipo: 'igual' })
    expect(variacao(1001, 1000)).toEqual({ tipo: 'igual' })
  })
})

describe('dia de São Paulo', () => {
  it('22h de Brasília ainda é o mesmo dia, mesmo já sendo amanhã em UTC', () => {
    expect(hojeEmSaoPaulo(new Date('2026-09-24T01:00:00Z'))).toBe('2026-09-23')
  })

  it('valida data de calendário e conta dias', () => {
    expect(ehDiaValido('2028-02-29')).toBe(true)
    expect(ehDiaValido('2026-02-29')).toBe(false)
    expect(diasEntre('2026-09-01', '2026-09-01')).toBe(1)
  })
})
