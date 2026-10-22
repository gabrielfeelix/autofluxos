import { describe, expect, it } from 'vitest'
import {
  competenciaParaCobrar,
  descricaoDoMes,
  fimDoDia,
  hojeEmSaoPaulo,
  mesSeguinte,
  primeiraCompetencia,
  vencimentoDa,
} from './mensalidade'

const regra = { inicio: '2026-11-01', fim: null, diaDoVencimento: 10, antecedenciaDias: 3 }

describe('competenciaParaCobrar', () => {
  it('cobra entre o dia de mandar e o vencimento', () => {
    expect(competenciaParaCobrar(regra, '2026-11-06')).toBeNull()
    expect(competenciaParaCobrar(regra, '2026-11-07')).toBe('2026-11-01')
    expect(competenciaParaCobrar(regra, '2026-11-10')).toBe('2026-11-01')
    expect(competenciaParaCobrar(regra, '2026-11-11')).toBeNull()
  })

  it('a antecedência atravessa o mês: vencimento dia 2 sai no fim do mês anterior', () => {
    const r = { ...regra, diaDoVencimento: 2, antecedenciaDias: 5 }
    expect(competenciaParaCobrar(r, '2026-11-28')).toBe('2026-12-01')
    expect(competenciaParaCobrar(r, '2026-12-31')).toBe('2027-01-01')
  })

  it('respeita início e fim', () => {
    expect(competenciaParaCobrar(regra, '2026-10-08')).toBeNull()
    expect(competenciaParaCobrar({ ...regra, fim: '2026-11-01' }, '2026-12-08')).toBeNull()
  })
})

describe('datas', () => {
  it('primeira competência pula para o mês seguinte quando o vencimento passou', () => {
    expect(primeiraCompetencia('2026-10-22', 25)).toBe('2026-10-01')
    expect(primeiraCompetencia('2026-10-22', 10)).toBe('2026-11-01')
  })

  it('dezembro vira janeiro', () => {
    expect(mesSeguinte('2026-12-01')).toBe('2027-01-01')
    expect(vencimentoDa('2027-01-01', 5)).toBe('2027-01-05')
  })

  it('fim do dia e hoje são de São Paulo', () => {
    expect(fimDoDia('2026-11-10').toISOString()).toBe('2026-11-11T02:59:59.000Z')
    expect(hojeEmSaoPaulo(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10')
  })

  it('descrição do mês cabe em 200', () => {
    expect(descricaoDoMes('Pilates 2x', '2026-11-01')).toBe('Pilates 2x (novembro de 2026)')
    expect(descricaoDoMes('x'.repeat(250), '2026-11-01').length).toBe(200)
  })
})
