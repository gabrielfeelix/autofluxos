import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assinarMensagens } from './conexao'

/**
 * O passo que faltava no OAuth: inscrever a conta no webhook.
 *
 * O que se testa aqui é o que não deixa rastro em produção — host, método,
 * campo, e a resposta `{"success": false}` que a Meta devolve com status 200
 * quando recusa. Nenhum dos quatro aparece em log quando está errado: a conta
 * fica verde na tela e o Inbox fica vazio.
 */

function fingirFetch(implementacao?: () => Promise<Response>) {
  const espiao = vi.fn(
    implementacao ?? (async () => new Response('{"success":true}', { status: 200 })),
  )
  vi.stubGlobal('fetch', espiao)
  return espiao
}

beforeEach(() => {
  vi.stubEnv('INSTAGRAM_APP_ID', '2275979176586034')
  vi.stubEnv('INSTAGRAM_APP_SECRET', 'segredo-de-mentira')
  vi.stubEnv('META_GRAPH_VERSION', 'v25.0')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('assinarMensagens', () => {
  it('pede `messages` no host do Instagram, com a conta profissional na URL', async () => {
    const espiao = fingirFetch()

    await assinarMensagens({ igUserId: '17841400183953038', token: 'token-longo' })

    const [url, init] = espiao.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://graph.instagram.com/v25.0/17841400183953038/subscribed_apps')
    expect(init.method).toBe('POST')

    const corpo = new URLSearchParams(String(init.body))
    expect(corpo.get('subscribed_fields')).toBe('messages')
    expect(corpo.get('access_token')).toBe('token-longo')
  })

  it('trata `success: false` como recusa, mesmo vindo com 200', async () => {
    fingirFetch(async () => new Response('{"success":false}', { status: 200 }))

    await expect(
      assinarMensagens({ igUserId: '17841400183953038', token: 'token-longo' }),
    ).rejects.toThrow(/recusou a inscrição/)
  })

  it('leva o texto da Meta junto quando a resposta não é 200', async () => {
    fingirFetch(
      async () =>
        new Response('{"error":{"message":"Permissions error"}}', { status: 400 }),
    )

    await expect(
      assinarMensagens({ igUserId: '17841400183953038', token: 'token-longo' }),
    ).rejects.toThrow(/Permissions error/)
  })
})
