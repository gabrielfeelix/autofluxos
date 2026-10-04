import { describe, expect, it } from 'vitest'
import { comCitacao } from './citacao-para-ia'

describe('comCitacao', () => {
  // PCYES, 02/out/2026: link de produto citado com ".".
  it('põe a mensagem citada pela própria pessoa antes do que ela escreveu', () => {
    expect(comCitacao('.', { texto: 'https://www.pcyes.com.br/tela-ptje-120', direcao: 'entrada' })).toBe(
      '(respondendo a uma mensagem anterior dele: "https://www.pcyes.com.br/tela-ptje-120")\n.',
    )
  })

  it('diz quando a citada é do bot', () => {
    expect(comCitacao('esse aqui', { texto: 'Temos o modelo X e o Y', direcao: 'saida' })).toContain('a uma mensagem sua')
  })

  it('sem citação, ou citada fora do histórico, o texto fica como veio', () => {
    expect(comCitacao('oi', undefined)).toBe('oi')
    expect(comCitacao('oi', { texto: null })).toBe('oi')
  })

  it('corta citada longa', () => {
    const r = comCitacao('?', { texto: 'a'.repeat(1000), direcao: 'entrada' })!
    expect(r.length).toBeLessThan(400)
  })
})
