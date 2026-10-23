import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Todo webhook de entrada recusa o que não prova de onde veio, antes de
 * encostar no banco (revisão de segurança de 19/out/2026, Parte 2).
 *
 * Três casos por rota: sem assinatura, com assinatura errada e com o segredo
 * ausente no ambiente. O terceiro é o que mais engana: `undefined` comparado
 * com `undefined` dá verdadeiro, e um deploy sem a variável abriria a porta.
 * O handshake `GET` da Meta tem o mesmo risco com o token de verificação.
 */
vi.mock('@/server/db', () => ({
  db: () => {
    throw new Error('o banco não pode ser tocado antes da assinatura')
  },
}))

const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
const assinar = (segredo: string) => `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`

const META = [
  { nome: 'whatsapp', carregar: () => import('./whatsapp/route') },
  { nome: 'instagram', carregar: () => import('./instagram/route') },
  { nome: 'leadgen', carregar: () => import('./leadgen/route') },
]

const pedir = (cabecalhos: Record<string, string> = {}) =>
  new Request('https://x.test/api/webhook', { method: 'POST', headers: cabecalhos, body: corpo })

beforeEach(() => {
  vi.stubEnv('META_APP_SECRET', 'segredo-certo')
  vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'token-certo')
  vi.stubEnv('INSTAGRAM_VERIFY_TOKEN', 'token-certo')
  vi.stubEnv('NUVEMSHOP_APP_ID', '123')
  vi.stubEnv('NUVEMSHOP_CLIENT_SECRET', 'segredo-certo')
})
afterEach(() => vi.unstubAllEnvs())

describe.each(META)('webhook $nome da Meta', ({ carregar }) => {
  it('recusa sem assinatura e com assinatura errada', async () => {
    const { POST } = await carregar()
    expect((await POST(pedir())).status).toBe(401)
    expect((await POST(pedir({ 'x-hub-signature-256': assinar('segredo-errado') }))).status).toBe(401)
    expect((await POST(pedir({ 'x-hub-signature-256': 'sha256=' }))).status).toBe(401)
  })

  it('recusa tudo quando o segredo não está configurado', async () => {
    vi.stubEnv('META_APP_SECRET', '')
    const { POST } = await carregar()
    expect((await POST(pedir({ 'x-hub-signature-256': assinar('') }))).status).toBe(401)
  })

  it('handshake recusa token errado e token ausente no ambiente', async () => {
    const { GET } = await carregar()
    const handshake = (token: string) =>
      GET(new Request(`https://x.test/?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`))
    expect((await handshake('errado')).status).toBe(403)
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '')
    vi.stubEnv('INSTAGRAM_VERIFY_TOKEN', '')
    expect((await handshake('')).status).toBe(403)
  })
})

describe('webhook da Nuvemshop', () => {
  const pedirLoja = (assinatura?: string) =>
    new Request('https://x.test/api/webhook/nuvemshop', {
      method: 'POST',
      headers: assinatura ? { 'x-linkedstore-hmac-sha256': assinatura } : {},
      body: corpo,
    })

  it('recusa sem assinatura, com assinatura errada e sem segredo', async () => {
    const { POST } = await import('./nuvemshop/route')
    expect((await POST(pedirLoja())).status).toBe(401)
    expect((await POST(pedirLoja(createHmac('sha256', 'errado').update(corpo).digest('hex')))).status).toBe(401)
    vi.stubEnv('NUVEMSHOP_CLIENT_SECRET', '')
    expect((await POST(pedirLoja(createHmac('sha256', '').update(corpo).digest('hex')))).status).toBe(401)
  })
})

describe('webhooks de pagamento', () => {
  it('Asaas recusa sem o token, com token de outra organização e sem segredo no servidor', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-certo')
    const { POST } = await import('./asaas/[clienteId]/route')
    const { segredoDoAviso } = await import('@/channels/asaas')
    const conta = '11111111-1111-1111-1111-111111111111'
    const outra = '22222222-2222-2222-2222-222222222222'
    const pedirAsaas = (token?: string) =>
      POST(
        new Request(`https://x.test/api/webhook/asaas/${conta}`, {
          method: 'POST',
          headers: token ? { 'asaas-access-token': token } : {},
          body: corpo,
        }),
        { params: Promise.resolve({ clienteId: conta }) },
      )
    expect((await pedirAsaas()).status).toBe(401)
    expect((await pedirAsaas(segredoDoAviso(outra))).status).toBe(401)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect((await pedirAsaas('')).status).toBe(401)
  })

  it('InfinitePay recusa sem o segredo do endereço, com o de outra organização e sem segredo no servidor', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-certo')
    const { POST } = await import('./infinitepay/[clienteId]/route')
    const { segredoDoAviso } = await import('@/channels/infinitepay')
    const conta = '11111111-1111-1111-1111-111111111111'
    const pedirInfinite = (t?: string) =>
      POST(new Request(`https://x.test/api/webhook/infinitepay/${conta}${t === undefined ? '' : `?t=${t}`}`, { method: 'POST', body: corpo }), {
        params: Promise.resolve({ clienteId: conta }),
      })
    expect((await pedirInfinite()).status).toBe(401)
    expect((await pedirInfinite(segredoDoAviso('22222222-2222-2222-2222-222222222222'))).status).toBe(401)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect((await pedirInfinite('')).status).toBe(401)
  })

  it('PagBank recusa sem o segredo do endereço, com o de outra organização e sem segredo no servidor', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-certo')
    const { POST } = await import('./pagbank/[endereco]/route')
    const { enderecoDoCliente, segredoDoAviso } = await import('@/channels/pagbank')
    const endereco = enderecoDoCliente('11111111-1111-1111-1111-111111111111')
    const pedirPagBank = (t?: string) =>
      POST(new Request(`https://x.test/api/webhook/pagbank/${endereco}${t === undefined ? '' : `?t=${t}`}`, { method: 'POST', body: corpo }), {
        params: Promise.resolve({ endereco }),
      })
    expect((await pedirPagBank()).status).toBe(401)
    expect((await pedirPagBank(segredoDoAviso('22222222-2222-2222-2222-222222222222'))).status).toBe(401)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect((await pedirPagBank('')).status).toBe(401)
  })

  it('mensalidade da 4YU recusa sem o token, com token de uma organização e sem segredo', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-certo')
    const { POST } = await import('./assinatura/route')
    const { segredoDoAviso } = await import('@/channels/asaas')
    const pedirMensalidade = (token?: string) =>
      POST(
        new Request('https://x.test/api/webhook/assinatura', {
          method: 'POST',
          headers: token ? { 'asaas-access-token': token } : {},
          body: corpo,
        }),
      )
    expect((await pedirMensalidade()).status).toBe(401)
    expect((await pedirMensalidade(segredoDoAviso('11111111-1111-1111-1111-111111111111'))).status).toBe(401)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect((await pedirMensalidade('')).status).toBe(401)
  })

  it('Mercado Pago recusa sem assinatura e sem segredo no servidor', async () => {
    const { POST } = await import('./mercado-pago/route')
    const pedirMp = (assinatura?: string) =>
      POST(
        new Request('https://x.test/api/webhook/mercado-pago?data.id=1&type=payment', {
          method: 'POST',
          headers: assinatura ? { 'x-signature': assinatura, 'x-request-id': 'r' } : {},
          body: corpo,
        }),
      )
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', 'segredo-certo')
    expect((await pedirMp()).status).toBe(401)
    expect((await pedirMp('ts=1,v1=abc')).status).toBe(401)
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', '')
    const v1 = createHmac('sha256', '').update('id:1;request-id:r;ts:1;').digest('hex')
    expect((await pedirMp(`ts=1,v1=${v1}`)).status).toBe(401)
  })
})
