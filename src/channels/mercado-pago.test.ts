import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renovarToken, trocarCodigo, urlDeAutorizacao } from './mercado-pago'

beforeEach(() => {
  vi.stubEnv('MERCADO_PAGO_CLIENT_ID', '123')
  vi.stubEnv('MERCADO_PAGO_CLIENT_SECRET', 'segredo')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function respondendo(status: number, corpo: unknown) {
  const chamada = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', chamada)
  return chamada
}

describe('Mercado Pago', () => {
  it('a autorização leva o state e o retorno exato', () => {
    const url = new URL(urlDeAutorizacao({ origem: 'https://app.test', state: 'abc' }))
    expect(url.searchParams.get('client_id')).toBe('123')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/api/pagamentos/mercado-pago/retorno')
  })

  it('troca o código pelo token, com validade e renovação', async () => {
    const chamada = respondendo(200, { access_token: 'APP_USR-x', refresh_token: 'TG-y', expires_in: 15552000, user_id: 987 })
    const token = await trocarCodigo({ codigo: 'TG-code', origem: 'https://app.test' })
    expect(token).toMatchObject({ token: 'APP_USR-x', renovacao: 'TG-y', contaId: '987' })
    expect(token.expiraEm!.getTime()).toBeGreaterThan(Date.now() + 179 * 86_400_000)
    const corpo = JSON.parse((chamada.mock.calls[0]![1] as RequestInit).body as string)
    expect(corpo).toMatchObject({ grant_type: 'authorization_code', code: 'TG-code', redirect_uri: 'https://app.test/api/pagamentos/mercado-pago/retorno' })
  })

  it('recusa sem ecoar o corpo do erro', async () => {
    respondendo(400, { message: 'invalid client_secret segredo' })
    await expect(renovarToken('TG-y')).rejects.toThrow('o Mercado Pago recusou o pedido de token (400)')
  })

  it('id de conta estranho não passa', async () => {
    respondendo(200, { access_token: 'x', user_id: '../1' })
    await expect(renovarToken('TG-y')).rejects.toThrow('id de conta estranho')
  })
})
