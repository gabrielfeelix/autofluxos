import { describe, expect, it } from 'vitest'
import { textoDaRajada } from './rajada'

const em = (segundos: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, segundos)).toISOString()

describe('textoDaRajada', () => {
  it('junta as entradas desde a última saída', () => {
    expect(
      textoDaRajada([
        { direcao: 'saida', texto: 'Oi!', ts: em(0) },
        { direcao: 'entrada', texto: 'Olá', ts: em(10) },
        { direcao: 'entrada', texto: 'Tudo bem', ts: em(11) },
        { direcao: 'entrada', texto: '?', ts: em(12) },
      ]),
    ).toBe('Olá\nTudo bem\n?')
  })

  it('não junta o que ficou longe demais da última', () => {
    expect(
      textoDaRajada([
        { direcao: 'entrada', texto: 'antiga', ts: em(0) },
        { direcao: 'entrada', texto: 'nova', ts: em(50) },
      ], 30_000),
    ).toBe('nova')
  })

  it('pula entrada sem texto e devolve null quando a última é saída', () => {
    expect(
      textoDaRajada([
        { direcao: 'entrada', texto: null, ts: em(0) },
        { direcao: 'entrada', texto: 'legenda', ts: em(1) },
      ]),
    ).toBe('legenda')
    expect(textoDaRajada([{ direcao: 'saida', texto: 'oi', ts: em(0) }])).toBeNull()
  })
})
