import { describe, expect, it } from 'vitest'
import {
  QUERY_BUSCA,
  linkDoProduto,
  normalizarEndereco,
  traduzirProdutos,
  traduzirRecomendacoes,
} from './loja'

const item = (sobre: Record<string, unknown> = {}) => ({
  sku: 'TAP-01',
  name: 'Tapete de yoga',
  url_key: 'tapete-de-yoga',
  stock_status: 'IN_STOCK',
  price_range: {
    minimum_price: {
      regular_price: { value: 199.9, currency: 'BRL' },
      final_price: { value: 149.9, currency: 'BRL' },
    },
  },
  ...sobre,
})
const resposta = (items: unknown[]) => ({ data: { products: { items } } })

describe('normalizarEndereco', () => {
  it('aceita https e tira barra e caminho do fim', () => {
    expect(normalizarEndereco('https://loja.com.br/')).toEqual({ ok: true, endereco: 'https://loja.com.br' })
    expect(normalizarEndereco(' https://loja.com.br/pt/ ')).toEqual({ ok: true, endereco: 'https://loja.com.br/pt' })
  })
  it('recusa http, sem protocolo, credencial na URL e query', () => {
    expect(normalizarEndereco('http://loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('https://a:b@loja.com.br').ok).toBe(false)
    expect(normalizarEndereco('https://loja.com.br/?x=1').ok).toBe(false)
  })
})

describe('traduzirProdutos', () => {
  it('traduz preço, promoção, estoque e link', () => {
    expect(traduzirProdutos(resposta([item()]), 'https://loja.com.br', '.html')).toEqual([
      {
        produtoId: 'TAP-01',
        nome: 'Tapete de yoga',
        preco: 149.9,
        precoDe: 199.9,
        emEstoque: true,
        link: 'https://loja.com.br/tapete-de-yoga.html',
      },
    ])
  })
  it('preço zero ou ausente vira sem preço, nunca R$ 0', () => {
    const zero = item({ price_range: { minimum_price: { regular_price: { value: 0 }, final_price: { value: 0 } } } })
    const p = traduzirProdutos(resposta([zero]), 'https://loja.com.br', '.html')[0]!
    expect(p.preco).toBeUndefined()
    expect(p.precoDe).toBeUndefined()
    const q = traduzirProdutos(resposta([item({ price_range: null })]), 'https://loja.com.br', '.html')[0]!
    expect(q.preco).toBeUndefined()
  })
  it('sem promoção não inventa precoDe', () => {
    const cheio = item({ price_range: { minimum_price: { regular_price: { value: 100 }, final_price: { value: 100 } } } })
    expect(traduzirProdutos(resposta([cheio]), 'https://loja.com.br', '.html')[0]!.precoDe).toBeUndefined()
  })
  it('descarta item sem sku, nome ou url_key e corta no limite', () => {
    const muitos = Array.from({ length: 9 }, (_, i) => item({ sku: `S${i}` }))
    expect(traduzirProdutos(resposta([item({ sku: '' }), ...muitos]), 'https://loja.com.br', '.html')).toHaveLength(5)
  })
  it('resposta com errors ou formato estranho vira lista vazia', () => {
    expect(traduzirProdutos({ errors: [{ message: 'x' }] }, 'https://loja.com.br', '.html')).toEqual([])
    expect(traduzirProdutos('lixo', 'https://loja.com.br', '.html')).toEqual([])
  })
})

describe('traduzirRecomendacoes', () => {
  it('junta crosssell e related, sem repetir, só o que tem estoque', () => {
    const json = resposta([
      item({
        crosssell_products: [item({ sku: 'A' }), item({ sku: 'B', stock_status: 'OUT_OF_STOCK' })],
        related_products: [item({ sku: 'A' }), item({ sku: 'C' })],
      }),
    ])
    expect(traduzirRecomendacoes(json, 'https://loja.com.br', '.html').map((p) => p.produtoId)).toEqual(['A', 'C'])
  })
})

describe('segurança da query', () => {
  it('o termo é variável, nunca texto da query', () => {
    expect(QUERY_BUSCA).toContain('$termo: String!')
    expect(QUERY_BUSCA).toContain('search: $termo')
  })
})

describe('linkDoProduto', () => {
  it('respeita sufixo vazio', () => {
    expect(linkDoProduto('https://loja.com.br', 'tapete', '')).toBe('https://loja.com.br/tapete')
  })
})
