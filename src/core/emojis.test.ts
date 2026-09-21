import { describe, expect, it } from 'vitest'
import { buscarEmojis, emojiDoItem, GRUPOS_DE_EMOJI } from './emojis'

describe('a busca de emoji', () => {
  it('acha por palavra em português', () => {
    expect(buscarEmojis('obrigado')).toContain('🙏')
    expect(buscarEmojis('festa')).toContain('🎉')
    expect(buscarEmojis('dinheiro')).toContain('💰')
  })

  /* Quem digita rápido não acentua, e exigir acento faz a busca falhar para quem tem pressa. */
  it('ignora acento e maiúscula', () => {
    expect(buscarEmojis('CORAÇÃO')).toContain('❤️')
    expect(buscarEmojis('localizacao')).toContain('📍')
  })

  it('casa por começo de palavra, e não por trecho solto', () => {
    expect(buscarEmojis('car')).toContain('🚗')
    // "máscara" tem "car" no meio, e sair aqui pareceria defeito.
    expect(buscarEmojis('car')).not.toContain('😷')
  })

  it('devolve vazio para o campo em branco, em vez da lista toda', () => {
    expect(buscarEmojis('')).toEqual([])
    expect(buscarEmojis('   ')).toEqual([])
  })

  it('respeita o teto', () => {
    expect(buscarEmojis('a', 5).length).toBeLessThanOrEqual(5)
  })
})

describe('o catálogo', () => {
  it('só tem item com emoji e pelo menos uma palavra', () => {
    for (const grupo of GRUPOS_DE_EMOJI) {
      for (const item of grupo.itens) {
        expect(item, `"${item}" precisa de emoji e palavras`).toMatch(/^\S+ \S/)
        expect(emojiDoItem(item)).not.toBe('')
      }
    }
  })

  /*
   * Emoji repetido vira `key` duplicada no React, e a grade some sem erro,
   * que é o jeito mais caro de descobrir um copiar e colar.
   */
  it('não repete emoji dentro do mesmo grupo', () => {
    for (const grupo of GRUPOS_DE_EMOJI) {
      const emojis = grupo.itens.map(emojiDoItem)
      expect(new Set(emojis).size, `repetido em ${grupo.nome}`).toBe(emojis.length)
    }
  })
})
