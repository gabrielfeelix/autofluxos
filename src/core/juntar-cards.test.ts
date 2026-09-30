import { describe, expect, it } from 'vitest'
import type { Acao } from './engine/types'
import type { ProdutoDaLoja } from './loja'
import { juntarFraseAosCards } from './juntar-cards'

const produto = (id: string, extra: Partial<ProdutoDaLoja> = {}): ProdutoDaLoja => ({
  produtoId: id,
  nome: `Produto ${id}`,
  emEstoque: true,
  foto: 'https://cdn/f.jpg',
  link: 'https://loja/p',
  ...extra,
})
const comFoto = (p: ProdutoDaLoja) => Boolean(p.foto && p.link)

describe('juntarFraseAosCards', () => {
  it('a frase seguida dos cards vira uma ação só', () => {
    const acoes: Acao[] = [
      { tipo: 'enviar_texto', texto: 'Veja estes:' },
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2')] },
      { tipo: 'enviar_texto', texto: 'Depois' },
    ]
    expect(juntarFraseAosCards(acoes, comFoto)).toEqual([
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2')], texto: 'Veja estes:' },
      { tipo: 'enviar_texto', texto: 'Depois' },
    ])
  })

  it('não junta quando algum produto não sai como card', () => {
    const acoes: Acao[] = [
      { tipo: 'enviar_texto', texto: 'Veja:' },
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2', { foto: undefined })] },
    ]
    expect(juntarFraseAosCards(acoes, comFoto)).toEqual(acoes)
  })

  it('não junta frase comprida nem frase que espera antes de sair', () => {
    const cards: Acao = { tipo: 'enviar_produtos', produtos: [produto('1')] }
    const longa: Acao[] = [{ tipo: 'enviar_texto', texto: 'x'.repeat(900) }, cards]
    const espera: Acao[] = [{ tipo: 'enviar_texto', texto: 'Oi', atrasoMs: 1000 }, cards]
    expect(juntarFraseAosCards(longa, comFoto)).toEqual(longa)
    expect(juntarFraseAosCards(espera, comFoto)).toEqual(espera)
  })
})
