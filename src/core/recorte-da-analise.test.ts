import { describe, expect, it } from 'vitest'
import { filtroDoRecorte, lerRecorte, recortesPossiveis } from './recorte-da-analise'

const tudo = { tipo: 'tudo' } as const
const daEquipe = { tipo: 'equipes', equipes: ['e1'] } as const

describe('recorte da análise', () => {
  it('cada um escolhe só até o próprio escopo', () => {
    expect(recortesPossiveis(tudo, 'u1', [])).toEqual(['eu', 'conta'])
    expect(recortesPossiveis(tudo, 'u1', ['e1'])).toEqual(['eu', 'equipe', 'conta'])
    expect(recortesPossiveis(daEquipe, 'u1', ['e1'])).toEqual(['eu', 'equipe'])
    expect(recortesPossiveis({ tipo: 'proprios', usuarioId: 'u1' }, 'u1', ['e1'])).toEqual(['eu'])
  })

  it('o padrão é o maior: para o dono, a conta, como antes do seletor', () => {
    expect(lerRecorte(null, ['eu', 'conta'])).toBe('conta')
    expect(lerRecorte('conta', ['eu', 'equipe'])).toBe('equipe')
    expect(lerRecorte('eu', ['eu', 'conta'])).toBe('eu')
  })

  it('o recorte só estreita', () => {
    expect(filtroDoRecorte(tudo, 'eu', 'u1', [])).toEqual({ tipo: 'proprios', usuarioId: 'u1' })
    expect(filtroDoRecorte(tudo, 'equipe', 'u1', ['e1'])).toEqual(daEquipe)
    expect(filtroDoRecorte(daEquipe, 'conta', 'u1', ['e1'])).toEqual(daEquipe)
    expect(filtroDoRecorte(tudo, 'conta', 'u1', [])).toEqual(tudo)
  })
})
