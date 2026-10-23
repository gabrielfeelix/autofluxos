import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { avisoAutentico, infinitepay, pagamentoDoAviso, segredoDoAviso, tagDaInfinitePay } from './infinitepay'

const acesso = { token: 'studiomgm', ambiente: 'producao' as const }
const pedido = {
  referencia: '5d0c1e2f-0000-4000-8000-000000000001',
  clienteId: '11111111-1111-1111-1111-111111111111',
  valorCentavos: 4990,
  descricao: 'Aula avulsa',
  venceEm: new Date('2026-10-30T12:00:00Z'),
  pagador: { nome: 'Ana', documento: null, telefone: '5544999990000', email: null },
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste')
  vi.stubEnv('VERCEL_ENV', 'production')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const responder = (json: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(json), { status }))

describe('tagDaInfinitePay', () => {
  it('aceita com ou sem $, e guarda sem', () => {
    expect(tagDaInfinitePay('$StudioMGM')).toBe('studiomgm')
    expect(tagDaInfinitePay(' studio.mgm ')).toBe('studio.mgm')
  })
  it('recusa o que não é tag', () => {
    expect(tagDaInfinitePay('')).toBeNull()
    expect(tagDaInfinitePay('tem espaço')).toBeNull()
    expect(tagDaInfinitePay('https://x.com')).toBeNull()
  })
})

describe('criarCobranca', () => {
  it('cria o link na conta da tag, com o total em centavos e o aviso assinado', async () => {
    const fetch = responder({ url: 'https://checkout.infinitepay.io/studiomgm/abc' })
    vi.stubGlobal('fetch', fetch)
    const criada = await infinitepay.criarCobranca(acesso, pedido)
    expect(criada).toEqual({ pagamentoId: `pedido|${pedido.referencia}`, preferenciaId: null, pixCopiaCola: null, link: 'https://checkout.infinitepay.io/studiomgm/abc' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.checkout.infinitepay.io/links')
    const corpo = JSON.parse(String(init.body))
    expect(corpo).toMatchObject({
      handle: 'studiomgm',
      items: [{ quantity: 1, price: 4990, description: 'Aula avulsa' }],
      order_nsu: pedido.referencia,
      customer: { name: 'Ana', phone_number: '+5544999990000' },
    })
    expect(corpo.webhook_url).toBe(
      `https://autofluxos.4yu.com.br/api/webhook/infinitepay/${pedido.clienteId}?t=${segredoDoAviso(pedido.clienteId)}`,
    )
  })

  it('resposta sem link é erro, e não cobrança muda', async () => {
    vi.stubGlobal('fetch', responder({ ok: true }))
    await expect(infinitepay.criarCobranca(acesso, pedido)).rejects.toThrow('sem o link')
  })
})

describe('o aviso e a conferência', () => {
  it('o aviso vira um id só, e lixo vira nada', () => {
    expect(pagamentoDoAviso({ invoice_slug: 'abc', transaction_nsu: 't1', order_nsu: 'p1', amount: 4990 })).toBe('abc|t1|p1')
    expect(pagamentoDoAviso({ invoice_slug: 'abc' })).toBeNull()
    expect(pagamentoDoAviso({ invoice_slug: 'a|b', transaction_nsu: 't', order_nsu: 'p' })).toBeNull()
  })

  it('confere no payment_check antes de dizer que pagou', async () => {
    const fetch = responder({ success: true, paid: true, amount: 4990, paid_amount: 5200, capture_method: 'credit_card' })
    vi.stubGlobal('fetch', fetch)
    const lido = await infinitepay.lerPagamento(acesso, 'abc|t1|p1')
    expect(lido).toMatchObject({ referencia: 'p1', situacao: 'paga', valorCentavos: 4990 })
    const corpo = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(corpo).toEqual({ handle: 'studiomgm', order_nsu: 'p1', transaction_nsu: 't1', slug: 'abc' })
  })

  it('sem transação (o id da criação), fica pendente sem chamar ninguém', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await infinitepay.lerPagamento(acesso, 'pedido|p1')).situacao).toBe('pendente')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('o segredo do endereço é por organização', () => {
    expect(avisoAutentico('c1', segredoDoAviso('c1'))).toBe(true)
    expect(avisoAutentico('c1', segredoDoAviso('c2'))).toBe(false)
    expect(avisoAutentico('c1', null)).toBe(false)
  })
})
