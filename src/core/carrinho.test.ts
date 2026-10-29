import { describe, expect, it } from 'vitest'
import { modelosDoCarrinho } from './carrinho'
import { componentesParaMeta, temErro, validarTemplate } from './templates'

const loja = { nome: 'PCYES', endereco: 'https://www.pcyes.com.br/', exemplo: 'https://acervo/x.jpg' }

describe('modelosDoCarrinho', () => {
  const modelos = modelosDoCarrinho(loja)

  it('um modelo por quantidade, de 1 a 10, todos válidos como marketing', () => {
    expect(modelos.map((m) => m.nome)).toEqual(Array.from({ length: 10 }, (_, i) => `carrinho_${i + 1}`))
    for (const m of modelos) expect(temErro(validarTemplate(m.nome, m.componentes, 'MARKETING'))).toBe(false)
  })

  it('carrossel sai com o mesmo cartão repetido na quantidade do modelo', () => {
    const meta = componentesParaMeta(modelos[2]!.componentes, { corpo: ['Maria'], cartaoMidia: 'h1', cartaoCorpo: ['Headset', 'R$ 1'] })
    expect(meta.map((c) => c.type)).toEqual(['BODY', 'CAROUSEL'])
    const cards = (meta[1] as { cards: { components: { type: string; url?: string }[] }[] }).cards
    expect(cards).toHaveLength(3)
    expect(cards[0]!.components.map((c) => c.type)).toEqual(['HEADER', 'BODY', 'BUTTONS'])
    expect(JSON.stringify(cards[0])).toContain('https://www.pcyes.com.br/{{1}}')
  })

  it('carrossel fora de marketing ou com cartões demais é recusado', () => {
    const { componentes } = modelos[1]!
    expect(temErro(validarTemplate('x', componentes, 'UTILITY'))).toBe(true)
    expect(temErro(validarTemplate('x', { ...componentes, carrossel: { ...componentes.carrossel!, cartoes: 11 } }, 'MARKETING'))).toBe(true)
  })
})
