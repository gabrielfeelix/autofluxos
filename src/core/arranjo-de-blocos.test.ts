import { describe, expect, it } from 'vitest'
import { escreverArranjo, lerArranjo, moverBloco, ordenarBlocos } from './arranjo-de-blocos'

describe('arranjo de blocos', () => {
  it('ida e volta pelo cookie', () => {
    const arranjo = { ordem: ['b', 'a'], ocultos: ['a'] }
    expect(lerArranjo(escreverArranjo(arranjo))).toEqual(arranjo)
  })

  it('cookie estragado vira arranjo vazio', () => {
    expect(lerArranjo('%7Bquebrado')).toEqual({ ordem: [], ocultos: [] })
    expect(lerArranjo(undefined)).toEqual({ ordem: [], ocultos: [] })
  })

  it('sem cookie, a ordem é a padrão', () => {
    expect(ordenarBlocos(['a', 'b', 'c'], { ordem: [], ocultos: [] })).toEqual(['a', 'b', 'c'])
  })

  it('bloco que sumiu sai, bloco novo entra depois do vizinho do padrão', () => {
    expect(ordenarBlocos(['a', 'b', 'c', 'd'], { ordem: ['c', 'velho', 'a'], ocultos: [] })).toEqual(['c', 'd', 'a', 'b'])
  })

  it('bloco novo no começo do padrão entra no começo', () => {
    expect(ordenarBlocos(['novo', 'a', 'b'], { ordem: ['b', 'a'], ocultos: [] })).toEqual(['novo', 'b', 'a'])
  })

  it('mover pula os escondidos', () => {
    expect(moverBloco(['a', 'b', 'c'], ['b'], 'c', -1)).toEqual(['c', 'b', 'a'])
    expect(moverBloco(['a', 'b', 'c'], [], 'a', -1)).toEqual(['a', 'b', 'c'])
  })
})
