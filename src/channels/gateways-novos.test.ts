import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { avisoAutentico, enderecoDoAviso, segredoDoAviso } from './aviso-por-endereco'
import { conectarWoovi, pagamentoDoAvisoDaWoovi, woovi } from './woovi'
import { conectarPagHiper, diasAteVencer, pagamentoDoAvisoDaPagHiper, paghiper } from './paghiper'
import { conectarPagarme, pagamentoDoAvisoDoPagarme, pagarme } from './pagarme'
import { conectarIugu, pagamentoDoAvisoDaIugu, iugu, parDeChavesParaIugu } from './iugu'
import { ErroDeConexao } from './pagamento'

/**
 * Os gateways de credencial colada (Woovi, PagHiper, Pagar.me, Iugu) contra
 * respostas simuladas, escritas a partir da documentação de cada um
 * (docs/gateways/pesquisa-*.md). Efí e Stripe têm arquivo próprio.
 */

const CLIENTE = '11111111-2222-4333-8444-555555555555'
const REF = '5d0c1e2f-0000-4000-8000-000000000001'
const pedido = {
  referencia: REF,
  clienteId: CLIENTE,
  valorCentavos: 5900,
  descricao: 'Aula avulsa',
  venceEm: new Date('2026-10-30T15:00:00Z'),
  pagador: { nome: 'Ana Souza', documento: '01234567890', telefone: '5544999990000', email: null },
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste')
  vi.stubEnv('VERCEL_ENV', 'production')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

type Chamada = [string, RequestInit]
const respostas = (...lista: { json: unknown; status?: number }[]) => {
  const fila = [...lista]
  return vi.fn(async () => {
    const r = fila.shift() ?? { json: {}, status: 200 }
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 })
  })
}

describe('o aviso por endereço', () => {
  it('segredo por gateway e por organização, falha fechada sem BETTER_AUTH_SECRET', () => {
    expect(avisoAutentico('woovi', CLIENTE, segredoDoAviso('woovi', CLIENTE))).toBe(true)
    expect(avisoAutentico('woovi', CLIENTE, segredoDoAviso('iugu', CLIENTE))).toBe(false)
    expect(avisoAutentico('woovi', CLIENTE, segredoDoAviso('woovi', '99999999-2222-4333-8444-555555555555'))).toBe(false)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect(avisoAutentico('woovi', CLIENTE, '')).toBe(false)
  })
  it('endereço de produção, com o extra no fim', () => {
    expect(enderecoDoAviso('efi', CLIENTE, '&ignorar=')).toBe(
      `https://dialogon.com.br/api/webhook/pagamento/efi/${CLIENTE}?t=${segredoDoAviso('efi', CLIENTE)}&ignorar=`,
    )
  })
})

describe('Woovi', () => {
  it('prova o AppID em produção, cadastra o aviso e guarda o AppID', async () => {
    const fetch = respostas({ json: { webhooks: [] } }, { json: { webhook: { id: 'wh_1' } } })
    vi.stubGlobal('fetch', fetch)
    const c = await conectarWoovi({ appId: 'Q2xpZW50X0lkXzEyMzQ1Njc4OTA6c2VjcmV0' }, CLIENTE)
    expect(c).toMatchObject({ ambiente: 'producao', avisoNoGateway: 'wh_1', token: 'Q2xpZW50X0lkXzEyMzQ1Njc4OTA6c2VjcmV0' })
    const [url, init] = fetch.mock.calls[1] as unknown as Chamada
    expect(url).toBe('https://api.woovi.com/api/v1/webhook')
    expect(init.headers).toMatchObject({ Authorization: 'Q2xpZW50X0lkXzEyMzQ1Njc4OTA6c2VjcmV0' })
    expect(JSON.parse(String(init.body)).webhook).toMatchObject({ event: 'OPENPIX:CHARGE_COMPLETED', url: enderecoDoAviso('woovi', CLIENTE) })
  })
  it('recusado em produção, tenta o sandbox; recusado nos dois, erro para a tela', async () => {
    vi.stubGlobal('fetch', respostas({ json: {}, status: 401 }, { json: {} }, { json: { webhook: { id: 'w' } } }))
    expect((await conectarWoovi({ appId: 'Q2xpZW50X0lkXzEyMzQ1Njc4OTA6c2VjcmV0' }, CLIENTE)).ambiente).toBe('teste')
    vi.stubGlobal('fetch', respostas({ json: {}, status: 401 }, { json: {}, status: 401 }))
    await expect(conectarWoovi({ appId: 'Q2xpZW50X0lkXzEyMzQ1Njc4OTA6c2VjcmV0' }, CLIENTE)).rejects.toBeInstanceOf(ErroDeConexao)
  })
  it('cobra em centavos com a referência como correlationID, sem exigir CPF', async () => {
    const fetch = respostas({ json: { charge: { correlationID: REF, status: 'ACTIVE', value: 5900, brCode: '000201pix', paymentLinkUrl: 'https://woovi.com/pay/x' } } })
    vi.stubGlobal('fetch', fetch)
    const criada = await woovi.criarCobranca({ token: 'app', ambiente: 'producao' }, { ...pedido, pagador: { ...pedido.pagador, documento: null } })
    expect(criada).toEqual({ pagamentoId: REF, preferenciaId: null, pixCopiaCola: '000201pix', link: 'https://woovi.com/pay/x' })
    const corpo = JSON.parse(String((fetch.mock.calls[0] as unknown as Chamada)[1].body))
    expect(corpo).toMatchObject({ correlationID: REF, value: 5900, customer: { name: 'Ana Souza', phone: '+5544999990000' } })
  })
  it('relê pela referência: COMPLETED é paga', async () => {
    vi.stubGlobal('fetch', respostas({ json: { charge: { correlationID: REF, status: 'COMPLETED', value: 5900, paidAt: '2026-10-23T15:00:00Z' } } }))
    expect(await woovi.lerPagamento({ token: 'app', ambiente: 'producao' }, REF)).toMatchObject({ situacao: 'paga', referencia: REF, valorCentavos: 5900 })
  })
  it('do aviso, só o correlationID', () => {
    expect(pagamentoDoAvisoDaWoovi({ event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: REF } })).toBe(REF)
    expect(pagamentoDoAvisoDaWoovi({ charge: { correlationID: '../x' } })).toBeNull()
    expect(pagamentoDoAvisoDaWoovi({ evento: 'teste' })).toBeNull()
  })
})

describe('PagHiper', () => {
  it('confere a chave pelo jeito do plugin oficial e guarda as duas em JSON', async () => {
    vi.stubGlobal('fetch', respostas({ json: { status_request: { result: 'reject', response_message: 'transacao nao encontrada' } } }))
    const c = await conectarPagHiper({ apiKey: 'apk_12345678-AbCdEf', token: 'ABCDEF1234567890' })
    expect(JSON.parse(c.token)).toEqual({ apiKey: 'apk_12345678-AbCdEf', token: 'ABCDEF1234567890' })
    vi.stubGlobal('fetch', respostas({ json: { status_request: { result: 'reject', response_message: 'apiKey invalida' } } }))
    await expect(conectarPagHiper({ apiKey: 'apk_12345678-AbCdEf', token: 'ABCDEF1234567890' })).rejects.toBeInstanceOf(ErroDeConexao)
  })
  it('cria o Pix com as credenciais no corpo, o aviso no endereço e o vencimento em dias', async () => {
    const fetch = respostas({ json: { pix_create_request: { result: 'success', transaction_id: 'HF97T5SH2ZQNLF6Z', pix_code: { emv: '000201ph', pix_url: 'https://pix.paghiper.com/x' } } } })
    vi.stubGlobal('fetch', fetch)
    const acesso = { token: JSON.stringify({ apiKey: 'apk_x', token: 't' }), ambiente: 'producao' as const }
    const criada = await paghiper.criarCobranca(acesso, pedido)
    expect(criada).toMatchObject({ pagamentoId: 'HF97T5SH2ZQNLF6Z', pixCopiaCola: '000201ph' })
    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe('https://pix.paghiper.com/invoice/create/')
    expect(JSON.parse(String(init.body))).toMatchObject({
      apiKey: 'apk_x',
      token: 't',
      order_id: REF,
      payer_cpf_cnpj: '01234567890',
      notification_url: enderecoDoAviso('paghiper', CLIENTE),
      items: [{ price_cents: 5900, quantity: 1 }],
    })
  })
  it('o aviso em formulário vira transação|notificação, relida no endpoint de notificação', async () => {
    const id = pagamentoDoAvisoDaPagHiper({ transaction_id: 'HF97T5SH2ZQNLF6Z', notification_id: 'W6QM6MORZW4KUENC0NU6ERN0AMCOWGCNOPAQ8XS7KRMW', apiKey: 'apk_x' })
    expect(id).toBe('HF97T5SH2ZQNLF6Z|W6QM6MORZW4KUENC0NU6ERN0AMCOWGCNOPAQ8XS7KRMW')
    const fetch = respostas({
      json: { status_request: { result: 'success', status: 'paid', order_id: REF, value_cents: 5900, value_cents_paid: 5900, status_date: '2026-10-23 10:00:00' } },
    })
    vi.stubGlobal('fetch', fetch)
    const lido = await paghiper.lerPagamento({ token: JSON.stringify({ apiKey: 'apk_x', token: 't' }), ambiente: 'producao' }, id!)
    expect(lido).toMatchObject({ pagamentoId: 'HF97T5SH2ZQNLF6Z', referencia: REF, situacao: 'paga', valorCentavos: 5900 })
    expect(lido.pagaEm?.toISOString()).toBe('2026-10-23T13:00:00.000Z')
    expect((fetch.mock.calls[0] as unknown as Chamada)[0]).toBe('https://pix.paghiper.com/invoice/notification/')
  })
  it('vencimento em dias inteiros, no mínimo um', () => {
    const agora = new Date('2026-10-23T12:00:00Z')
    expect(diasAteVencer(new Date('2026-10-23T13:00:00Z'), agora)).toBe(1)
    expect(diasAteVencer(new Date('2026-10-26T12:00:00Z'), agora)).toBe(3)
  })
})

describe('Pagar.me', () => {
  it('ambiente pelo prefixo da chave; chave recusada vira erro para a tela', async () => {
    vi.stubGlobal('fetch', respostas({ json: { data: [] } }))
    expect((await conectarPagarme({ chave: 'sk_test_abcdef123456' })).ambiente).toBe('teste')
    vi.stubGlobal('fetch', respostas({ json: {}, status: 401 }))
    await expect(conectarPagarme({ chave: 'sk_abcdef123456' })).rejects.toBeInstanceOf(ErroDeConexao)
  })
  it('pedido Pix com customer completo e a referência no code', async () => {
    const fetch = respostas({ json: { charges: [{ id: 'ch_abcdef1234567890', status: 'pending', amount: 5900, last_transaction: { qr_code: '000201pm' } }] } })
    vi.stubGlobal('fetch', fetch)
    const criada = await pagarme.criarCobranca({ token: 'sk_x', ambiente: 'producao' }, pedido)
    expect(criada).toMatchObject({ pagamentoId: 'ch_abcdef1234567890', pixCopiaCola: '000201pm' })
    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe('https://api.pagar.me/core/v5/orders')
    expect(init.headers).toMatchObject({ Authorization: `Basic ${Buffer.from('sk_x:').toString('base64')}` })
    expect(JSON.parse(String(init.body))).toMatchObject({
      code: REF,
      customer: { document: '01234567890', document_type: 'CPF', phones: { mobile_phone: { area_code: '44', number: '999990000' } } },
      payments: [{ payment_method: 'pix' }],
    })
  })
  it('do aviso sai o id da cobrança, de charge.* e de order.*', () => {
    expect(pagamentoDoAvisoDoPagarme({ type: 'charge.paid', data: { id: 'ch_abcdef1234567890' } })).toBe('ch_abcdef1234567890')
    expect(pagamentoDoAvisoDoPagarme({ type: 'order.paid', data: { id: 'or_x', charges: [{ id: 'ch_abcdef1234567890' }] } })).toBe('ch_abcdef1234567890')
    expect(pagamentoDoAvisoDoPagarme({ type: 'charge.paid', data: { id: 'or_x' } })).toBeNull()
  })
  it('relê: paga com o valor pago e a referência do metadata', async () => {
    vi.stubGlobal(
      'fetch',
      respostas({ json: { id: 'ch_abcdef1234567890', status: 'paid', amount: 5900, paid_amount: 5900, paid_at: '2026-10-23T13:00:00Z', metadata: { referencia: REF } } }),
    )
    expect(await pagarme.lerPagamento({ token: 'sk_x', ambiente: 'producao' }, 'ch_abcdef1234567890')).toMatchObject({ situacao: 'paga', referencia: REF })
  })
})

describe('Iugu', () => {
  it('a chave pública é PEM e a privada não sai', () => {
    expect(parDeChavesParaIugu()).toMatch(/^-----BEGIN PUBLIC KEY-----/)
  })
  it('token ainda não aprovado vira erro claro; aprovado, cadastra o gatilho', async () => {
    vi.stubGlobal('fetch', respostas({ json: {}, status: 401 }))
    await expect(conectarIugu({ token: 'ABCDEF1234567890ABCDEF1234567890' }, CLIENTE)).rejects.toThrow(/administrador/)
    const fetch = respostas({ json: { items: [] } }, { json: { id: 'gat_1' } })
    vi.stubGlobal('fetch', fetch)
    expect((await conectarIugu({ token: 'ABCDEF1234567890ABCDEF1234567890' }, CLIENTE)).avisoNoGateway).toBe('gat_1')
    expect(JSON.parse(String((fetch.mock.calls[1] as unknown as Chamada)[1].body))).toEqual({
      event: 'invoice.status_changed',
      url: enderecoDoAviso('iugu', CLIENTE),
    })
  })
  it('fatura só Pix, com a referência e idempotência', async () => {
    const fetch = respostas({ json: { id: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4', status: 'pending', secure_url: 'https://faturas.iugu.com/x', pix: { qrcode_text: '000201iu' } } })
    vi.stubGlobal('fetch', fetch)
    const criada = await iugu.criarCobranca({ token: 't', ambiente: 'producao' }, pedido)
    expect(criada).toMatchObject({ pixCopiaCola: '000201iu', link: 'https://faturas.iugu.com/x' })
    const [, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(init.headers).toMatchObject({ 'Idempotency-Key': REF })
    expect(JSON.parse(String(init.body))).toMatchObject({ payable_with: ['pix'], external_reference: REF, due_date: '2026-10-30' })
  })
  it('o gatilho em formulário entrega data[id]', () => {
    expect(pagamentoDoAvisoDaIugu({ event: 'invoice.status_changed', 'data[id]': 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4' })).toBe('A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4')
    expect(pagamentoDoAvisoDaIugu({ 'data[id]': '../x' })).toBeNull()
  })
})
