import { describe, expect, it } from 'vitest'
import {
  enderecoDaLojaNuvemshop,
  linkDaBuscaNuvemshop,
  traduzirListaNuvemshop,
  traduzirProdutoNuvemshop,
} from './nuvemshop'

const LOJA = 'https://pokeloja.nuvemshop.com.br'

// O formato da doc oficial (resources/product), reduzido ao que o bot lê.
const bola = {
  id: 1234,
  name: { pt: 'Master Ball', es: 'Master Ball' },
  handle: { pt: 'master-ball' },
  published: true,
  images: [{ src: 'http://d26lpennugtm8s.cloudfront.net/stores/001/master.jpg' }],
  variants: [{ price: '25.00', promotional_price: '19.90', stock: 5, stock_management: true, sku: 'MB-01' }],
}

describe('traduzirProdutoNuvemshop', () => {
  it('traduz nome por idioma, promoção, estoque exato, foto em https e link pelo handle', () => {
    expect(traduzirProdutoNuvemshop(bola, LOJA)).toEqual({
      produtoId: 'MB-01',
      nome: 'Master Ball',
      preco: 19.9,
      precoDe: 25,
      emEstoque: true,
      quantidade: 5,
      foto: 'https://d26lpennugtm8s.cloudfront.net/stores/001/master.jpg',
      link: `${LOJA}/produtos/master-ball/`,
    })
  })

  it('usa canonical_url quando vem', () => {
    const p = traduzirProdutoNuvemshop({ ...bola, canonical_url: `${LOJA}/produtos/outra/` }, LOJA)
    expect(p?.link).toBe(`${LOJA}/produtos/outra/`)
  })

  it('variações com preços diferentes viram "a partir de", nunca preço', () => {
    const p = traduzirProdutoNuvemshop(
      { ...bola, variants: [{ price: '30.00', stock: 1, stock_management: true }, { price: '20.00', stock: 0, stock_management: true }] },
      LOJA,
    )
    expect(p?.precoAPartirDe).toBe(20)
    expect(p?.preco).toBeUndefined()
  })

  it('estoque infinito: em estoque e sem quantidade inventada', () => {
    const p = traduzirProdutoNuvemshop(
      { ...bola, variants: [{ price: '10', stock: null, stock_management: false }, { price: '10', stock: 2, stock_management: true }] },
      LOJA,
    )
    expect(p?.emEstoque).toBe(true)
    expect(p?.quantidade).toBeUndefined()
  })

  it('esgotado quando toda variação contada está em zero', () => {
    const p = traduzirProdutoNuvemshop({ ...bola, variants: [{ price: '10', stock: 0, stock_management: true }] }, LOJA)
    expect(p?.emEstoque).toBe(false)
    expect(p?.quantidade).toBe(0)
  })

  it('sem SKU, o id do produto com prefixo', () => {
    const p = traduzirProdutoNuvemshop({ ...bola, variants: [{ price: '10', stock: 1, stock_management: true, sku: null }] }, LOJA)
    expect(p?.produtoId).toBe('ns-1234')
  })

  it('oculto ou sem nome não aparece', () => {
    expect(traduzirProdutoNuvemshop({ ...bola, published: false }, LOJA)).toBeNull()
    expect(traduzirProdutoNuvemshop({ ...bola, name: {} }, LOJA)).toBeNull()
  })
})

describe('traduzirListaNuvemshop', () => {
  it('resposta que não é lista vira vazio; corta no limite', () => {
    expect(traduzirListaNuvemshop({ code: 404 }, LOJA)).toEqual([])
    expect(traduzirListaNuvemshop(Array.from({ length: 9 }, () => bola), LOJA)).toHaveLength(5)
  })
})

describe('enderecoDaLojaNuvemshop', () => {
  it('prefere o domínio próprio; senão o original; sempre https', () => {
    expect(enderecoDaLojaNuvemshop({ domains: ['www.minhaloja.com.br'], original_domain: 'x.nuvemshop.com.br' })).toBe(
      'https://www.minhaloja.com.br',
    )
    expect(enderecoDaLojaNuvemshop({ domains: [], original_domain: 'x.nuvemshop.com.br' })).toBe('https://x.nuvemshop.com.br')
    expect(enderecoDaLojaNuvemshop({ original_domain: 'nada' })).toBeNull()
  })
})

describe('linkDaBuscaNuvemshop', () => {
  it('monta a busca da vitrine', () => {
    expect(linkDaBuscaNuvemshop(LOJA, ' bola azul ')).toBe(`${LOJA}/search/?q=bola%20azul`)
  })
})
