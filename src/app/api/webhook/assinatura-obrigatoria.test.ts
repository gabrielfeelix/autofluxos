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
