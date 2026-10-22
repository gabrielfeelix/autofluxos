import { describe, expect, it } from 'vitest'
import type { ProdutoDaLoja } from './loja'
import { conferirItens, descricaoDosItens, itensDoJson } from './cobrar-do-catalogo'

const pizza: ProdutoDaLoja = { produtoId: 'PZ-G', nome: 'Pizza grande', preco: 54.9, emEstoque: true, especie: 'produto', link: '' }
const coca: ProdutoDaLoja = { produtoId: 'COCA', nome: 'Coca 2L', preco: 12, emEstoque: true, link: '' }

describe('conferirItens', () => {
  it('soma em centavos pelo preço relido, junta o mesmo item e diz a fonte', () => {
    const r = conferirItens(
      [
        { produtoId: 'PZ-G', quantidade: 1 },
        { produtoId: 'COCA', quantidade: 2 },
        { produtoId: 'PZ-G', quantidade: 1 },
      ],
      [pizza, coca],
    )
    expect(r).toEqual({
      ok: true,
      totalCentavos: 2 * 5490 + 2 * 1200,
      descricao: '2x Pizza grande, 2x Coca 2L',
      itens: [
        { nome: 'Pizza grande', quantidade: 2, valorCentavos: 5490, produtoId: 'PZ-G', fonte: 'catalogo' },
        { nome: 'Coca 2L', quantidade: 2, valorCentavos: 1200, produtoId: 'COCA', fonte: 'loja' },
      ],
    })
  })

  it('a descrição digitada vale mais que a montada', () => {
    const r = conferirItens([{ produtoId: 'COCA', quantidade: 1 }], [coca], ' Pedido de sexta ')
    expect(r.ok && r.descricao).toBe('Pedido de sexta')
  })

  it('recusa item sem preço, com preço por variação ou que sumiu', () => {
    const semPreco = { ...coca, preco: undefined }
    expect(conferirItens([{ produtoId: 'COCA', quantidade: 1 }], [semPreco])).toMatchObject({ ok: false, erro: expect.stringContaining('sem preço') })
    const variacao = { ...coca, preco: undefined, precoAPartirDe: 10 }
    expect(conferirItens([{ produtoId: 'COCA', quantidade: 1 }], [variacao])).toMatchObject({ ok: false, erro: expect.stringContaining('variação') })
    expect(conferirItens([{ produtoId: 'X', quantidade: 1 }], [coca]).ok).toBe(false)
  })

  it('recusa quantidade quebrada, zero ou acima do teto, e lista vazia', () => {
    expect(conferirItens([{ produtoId: 'COCA', quantidade: 1.5 }], [coca]).ok).toBe(false)
    expect(conferirItens([{ produtoId: 'COCA', quantidade: 0 }], [coca]).ok).toBe(false)
    expect(conferirItens([{ produtoId: 'COCA', quantidade: 51 }], [coca]).ok).toBe(false)
    expect(conferirItens([], [coca]).ok).toBe(false)
  })
})

describe('descricaoDosItens', () => {
  it('corta em 200 com "e mais N"', () => {
    const itens = Array.from({ length: 12 }, (_, i) => ({ nome: `Produto com nome comprido número ${i}`, quantidade: 1 }))
    const texto = descricaoDosItens(itens)
    expect(texto.length).toBeLessThanOrEqual(200)
    expect(texto).toMatch(/e mais \d+$/)
  })
})

describe('itensDoJson', () => {
  it('descarta o que não tem forma de item', () => {
    expect(itensDoJson([{ nome: 'A', quantidade: 1, valorCentavos: 100 }, { nome: 'B' }, null])).toEqual([
      { nome: 'A', quantidade: 1, valorCentavos: 100 },
    ])
    expect(itensDoJson(null)).toEqual([])
  })
})
