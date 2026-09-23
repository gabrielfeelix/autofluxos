import { describe, expect, it } from 'vitest'
import {
  QUERY_BUSCA,
  linhasDoCard,
  linkDoProduto,
  textoDoCard,
  traduzirPorSku,
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

describe('traduzirPorSku', () => {
  it('devolve na ordem pedida e some com o SKU que a loja não trouxe', () => {
    const json = resposta([item({ sku: 'B', name: 'Bola', url_key: 'bola' }), item({ sku: 'A' })])
    const r = traduzirPorSku(json, ['A', 'SUMIU', 'B'], 'https://loja.com.br', '')
    expect(r.map((p) => p.produtoId)).toEqual(['A', 'B'])
  })
})

describe('card do produto', () => {
  const base = { produtoId: 'A', nome: 'Headset CM500', emEstoque: true, link: 'https://loja.com.br/cm500' }

  it('promoção vira de/por', () => {
    expect(linhasDoCard({ ...base, preco: 95.92, precoDe: 119.9 })).toEqual({
      titulo: 'Headset CM500',
      detalhe: 'de R$ 119,90 por R$ 95,92, em estoque',
    })
  })
  it('sem preço não escreve preço nenhum, nunca R$ 0,00', () => {
    expect(linhasDoCard(base).detalhe).toBe('em estoque')
  })
  it('poucas unidades aparecem; muitas não', () => {
    expect(linhasDoCard({ ...base, preco: 10, quantidade: 1 }).detalhe).toBe('R$ 10,00, última unidade')
    expect(linhasDoCard({ ...base, preco: 10, quantidade: 3 }).detalhe).toBe('R$ 10,00, últimas 3 unidades')
    expect(linhasDoCard({ ...base, preco: 10, quantidade: 40 }).detalhe).toBe('R$ 10,00, em estoque')
  })
  it('esgotado diz esgotado', () => {
    expect(linhasDoCard({ ...base, preco: 10, emEstoque: false }).detalhe).toBe('R$ 10,00, esgotado')
  })
  it('o texto do card termina no link', () => {
    expect(textoDoCard({ ...base, preco: 10 })).toBe('Headset CM500\nR$ 10,00, em estoque\nhttps://loja.com.br/cm500')
  })
})
