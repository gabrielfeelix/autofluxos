import { beforeAll, describe, expect, it } from 'vitest'
import { comLinkRastreado, lerLinkRastreado } from './link-de-produto'

const produto = { produtoId: '330107', nome: 'Headset CM500', emEstoque: true, link: 'https://pcyes.com.br/headset-cm500' }
const contato = { id: 'contato-1', clienteId: 'cliente-1' }

describe('o link do "Ver produto"', () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'segredo-de-teste'
  })

  it('volta ao destino e diz de quem é o clique', () => {
    const { link } = comLinkRastreado(produto, contato)
    expect(link.startsWith('https://autofluxos.4yu.com.br/api/site/produto/')).toBe(true)
    const token = link.split('/').pop()!
    expect(lerLinkRastreado(token)).toEqual({ k: 'cliente-1', c: 'contato-1', u: produto.link, n: 'Headset CM500' })
  })

  it('recusa destino trocado: o domínio não vira redirecionador de golpe', () => {
    const token = comLinkRastreado(produto, contato).link.split('/').pop()!
    const [, assinatura] = token.split('.')
    const falso = Buffer.from(JSON.stringify({ k: 'x', c: 'y', u: 'https://golpe.example', n: 'z' })).toString('base64url')
    expect(lerLinkRastreado(`${falso}.${assinatura}`)).toBeNull()
  })
})
