import { describe, expect, it } from 'vitest'
import {
  comoMandarProduto,
  cepLimpo,
  traduzirFrete,
  LIMITE_DA_FICHA,
  limparHtml,
  traduzirFicha,
  QUERY_BUSCA,
  linhasDoCard,
  linkDaBusca,
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
  it('catálogo sem controle de estoque não escreve "em estoque"', () => {
    expect(linhasDoCard({ ...base, preco: 150, semControleDeEstoque: true }).detalhe).toBe('R$ 150,00')
  })
  it('sem link e sem detalhe, o texto não deixa linha vazia', () => {
    expect(textoDoCard({ ...base, link: '', semControleDeEstoque: true })).toBe('Headset CM500')
    expect(textoDoCard({ ...base, link: '', preco: 10, semControleDeEstoque: true })).toBe('Headset CM500\nR$ 10,00')
  })
})

describe('produto com variações de preço', () => {
  const variavel = item({
    price_range: {
      minimum_price: { regular_price: { value: 999 }, final_price: { value: 799 } },
      maximum_price: { final_price: { value: 1099 } },
    },
  })

  it('vira "a partir de", sem preço cheio e sem de/por', () => {
    const [p] = traduzirProdutos(resposta([variavel]), 'https://loja.com.br', '')
    expect(p).toMatchObject({ precoAPartirDe: 799 })
    expect(p).not.toHaveProperty('preco')
    expect(p).not.toHaveProperty('precoDe')
    expect(linhasDoCard(p!).detalhe).toBe('a partir de R$ 799,00, em estoque')
  })

  it('máximo igual ao mínimo continua preço normal', () => {
    const fixo = item({
      price_range: {
        minimum_price: { regular_price: { value: 199.9 }, final_price: { value: 149.9 } },
        maximum_price: { final_price: { value: 149.9 } },
      },
    })
    const [p] = traduzirProdutos(resposta([fixo]), 'https://loja.com.br', '')
    expect(p).toMatchObject({ preco: 149.9, precoDe: 199.9 })
    expect(p).not.toHaveProperty('precoAPartirDe')
  })
})

describe('linkDaBusca', () => {
  it('codifica o termo na página de busca padrão do Magento', () => {
    expect(linkDaBusca('https://loja.com.br', ' mouse & teclado ')).toBe(
      'https://loja.com.br/catalogsearch/result/?q=mouse%20%26%20teclado',
    )
  })
})

describe('a ficha do produto', () => {
  it('tira o CSS escapado de dentro do Page Builder, em duas passadas', () => {
    const html =
      '<style>#html-body{display:flex}</style><div data-content-type="html">' +
      '&lt;style&gt;.pcyes-desc{color:red}&lt;/style&gt;' +
      '&lt;p class="x"&gt;Drivers de 40mm, 20Hz a 20kHz.&lt;/p&gt;' +
      '&lt;td&gt;&lt;span&gt;Cabo&lt;/span&gt;&lt;span&gt;1,8m&lt;/span&gt;&lt;/td&gt;</div>'
    const texto = limparHtml(html)
    expect(texto).not.toMatch(/display|color|pcyes|<|&lt;/)
    expect(texto).toContain('Drivers de 40mm, 20Hz a 20kHz.')
    expect(texto).toContain('Cabo 1,8m')
  })

  it('curta primeiro, corte no limite e atributo interno fora', () => {
    const json = {
      data: {
        products: {
          items: [
            {
              sku: '330107',
              name: 'Headset CM500',
              short_description: { html: 'Compatível com Windows e Linux.' },
              description: { html: `<p>${'longo '.repeat(600)}</p>` },
            },
          ],
        },
      },
    }
    const atributos = {
      data: {
        products: {
          items: [
            {
              custom_attributesV2: {
                items: [
                  { code: 'headsetcommicrofone', selected_options: [{ label: 'Retrátil' }] },
                  { code: 'status', selected_options: [{ label: 'Habilitado' }] },
                  { code: 'price', value: '108.9' },
                ],
              },
            },
          ],
        },
      },
    }
    const ficha = traduzirFicha(json, atributos)!
    expect(ficha.descricao.startsWith('Compatível com Windows e Linux.')).toBe(true)
    expect(ficha.descricao.length).toBeLessThanOrEqual(LIMITE_DA_FICHA + 1)
    expect(ficha.especificacoes).toEqual(['headsetcommicrofone: Retrátil'])
  })

  it('SKU que não veio é null, e atributo recusado não derruba a ficha', () => {
    expect(traduzirFicha({ data: { products: { items: [] } } }, null)).toBeNull()
    const so = traduzirFicha({ data: { products: { items: [{ sku: 'a', name: 'b' }] } } }, null)
    expect(so).toEqual({ produtoId: 'a', nome: 'b', descricao: '', especificacoes: [] })
  })
})

describe('o frete por CEP', () => {
  it('CEP só com 8 dígitos, com ou sem traço', () => {
    expect(cepLimpo('87013-000')).toBe('87013000')
    expect(cepLimpo('Maringá')).toBeNull()
    expect(cepLimpo('8701300')).toBeNull()
  })

  it('mais barato primeiro, indisponível fora, prazo no nome do serviço', () => {
    const json = [
      { carrier_title: 'CORREIOS', method_title: 'SEDEX (3 dias úteis)', amount: 32.68, available: true },
      { carrier_title: 'BIAGI', method_title: 'Normal (1 dia útil)', amount: 28.66, available: true },
      { carrier_title: 'X', method_title: 'Y', amount: 10, available: false },
    ]
    expect(traduzirFrete(json)).toEqual([
      { transportadora: 'BIAGI', servico: 'Normal (1 dia útil)', preco: 28.66 },
      { transportadora: 'CORREIOS', servico: 'SEDEX (3 dias úteis)', preco: 32.68 },
    ])
    expect(traduzirFrete({ message: 'erro' })).toEqual([])
  })
})

describe('como o produto sai no canal', () => {
  const f = 'https://x/foto.jpg'
  it('com link e foto, e canal de card: card', () => {
    expect(comoMandarProduto({ link: 'https://loja/p', foto: f }, { temCard: true })).toBe('card')
  })
  it('foto sem link: a foto com legenda, e não mais texto sem foto', () => {
    expect(comoMandarProduto({ link: '', foto: f }, { temCard: true })).toBe('imagem')
    expect(comoMandarProduto({ link: '', foto: f }, { temCard: false })).toBe('imagem')
  })
  it('sem foto: texto, a não ser que o canal desenhe card sem foto', () => {
    expect(comoMandarProduto({ link: 'https://loja/p' }, { temCard: true })).toBe('texto')
    expect(comoMandarProduto({ link: 'https://loja/p' }, { temCard: true, cardSemFoto: true })).toBe('card')
  })
  it('com link e foto, mas canal sem card: texto com o link, como antes', () => {
    expect(comoMandarProduto({ link: 'https://loja/p', foto: f }, { temCard: false })).toBe('texto')
  })
})
