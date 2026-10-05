import { describe, expect, it } from 'vitest'
import dados from './emojis-completos.json'
import { buscarEmojis, type CategoriaDeEmoji } from './emojis-completos'

const categorias = dados as CategoriaDeEmoji[]

describe('emojis completos', () => {
  it('traz as oito categorias do WhatsApp, cheias', () => {
    expect(categorias.map((c) => c.nome)).toEqual([
      'Smileys e pessoas',
      'Animais e natureza',
      'Comidas e bebidas',
      'Atividades',
      'Viagens e lugares',
      'Objetos',
      'Símbolos',
      'Bandeiras',
    ])
    expect(categorias.reduce((soma, c) => soma + c.itens.length, 0)).toBeGreaterThan(1800)
  })

  it('acha por palavra em português, sem acento', () => {
    expect(buscarEmojis(categorias, 'coracao')).toContain('❤️')
    expect(buscarEmojis(categorias, 'cachorro')).toContain('🐶')
    expect(buscarEmojis(categorias, 'brasil')).toContain('🇧🇷')
  })

  it('busca por prefixo de palavra, e todas as palavras precisam casar', () => {
    expect(buscarEmojis(categorias, 'car')).toContain('🚗')
    expect(buscarEmojis(categorias, 'rosto risonho')).toContain('😀')
    expect(buscarEmojis(categorias, '')).toEqual([])
  })
})
