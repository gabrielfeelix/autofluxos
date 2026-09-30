import { describe, expect, it } from 'vitest'
import { iniciais } from './iniciais'

describe('iniciais', () => {
  it('nome comum: primeira e última palavra', () => {
    expect(iniciais('Ana Paula Souza')).toBe('AS')
    expect(iniciais('Will')).toBe('W')
  })

  it('letra estilizada do WhatsApp vira letra comum, sem cortar ao meio', () => {
    expect(iniciais('𝒟𝑜𝓊𝑔𝓁𝒶𝓈 𝒜𝓁𝓋𝑒𝓈')).toBe('DA')
  })

  it('enfeite antes do nome não vira inicial', () => {
    expect(iniciais('~𝓛𝓮𝓸𝓷𝓪𝓻𝓭𝓸 𝓐𝓫𝓻𝓮𝓾')).toBe('LA')
  })

  it('nome só de emoji fica com o emoji', () => {
    expect(iniciais('😎')).toBe('😎')
  })

  it('vazio vira interrogação', () => {
    expect(iniciais('  ')).toBe('?')
    expect(iniciais(null)).toBe('?')
  })

  it('palavra única pode dar duas letras onde cabe', () => {
    expect(iniciais('PCYES', { palavraUnica: 2 })).toBe('PC')
  })
})
