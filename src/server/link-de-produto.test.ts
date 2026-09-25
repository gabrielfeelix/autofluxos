import { beforeAll, describe, expect, it } from 'vitest'
import { comLinkRastreado, comUtm, lerLinkRastreado } from './link-de-produto'

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
    expect(lerLinkRastreado(token)).toEqual({
      k: 'cliente-1',
      c: 'contato-1',
      u: 'https://pcyes.com.br/headset-cm500?utm_source=whatsapp&utm_medium=chatbot&utm_campaign=autofluxos&utm_content=robo',
      n: 'Headset CM500',
    })
  })

  it('recusa destino trocado: o domínio não vira redirecionador de golpe', () => {
    const token = comLinkRastreado(produto, contato).link.split('/').pop()!
    const [, assinatura] = token.split('.')
    const falso = Buffer.from(JSON.stringify({ k: 'x', c: 'y', u: 'https://golpe.example', n: 'z' })).toString('base64url')
    expect(lerLinkRastreado(`${falso}.${assinatura}`)).toBeNull()
  })

  it('UTM da loja ou da campanha que já estiver no link fica como está', () => {
    expect(comUtm('https://loja.com/p?utm_source=instagram&cor=preto', 'site', 'atendimento', { id: '3f9a1c2e-0000-4000-8000-000000000000', nome: 'Ana Souza' })).toBe(
      'https://loja.com/p?utm_source=instagram&cor=preto&utm_medium=atendimento&utm_campaign=autofluxos&utm_content=ana-souza-3f9a1c2e',
    )
  })
})
