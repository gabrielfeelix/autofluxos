import { describe, expect, it } from 'vitest'
import { naoLidasVivas } from './fila-viva'

describe('naoLidasVivas', () => {
  it('o número vivo vale por cima do servidor', () => {
    const juntas = naoLidasVivas(new Map([['a', 1]]), new Map([['a', 3], ['b', 2]]))
    expect([...juntas]).toEqual([['a', 3], ['b', 2]])
  })

  it('zero vivo tira a conversa, para o "Não lidas" não contar quem já foi lido', () => {
    const juntas = naoLidasVivas(new Map([['a', 2], ['b', 1]]), new Map([['a', 0], ['c', 0]]))
    expect(juntas.size).toBe(1)
    expect(juntas.get('b')).toBe(1)
  })
})
