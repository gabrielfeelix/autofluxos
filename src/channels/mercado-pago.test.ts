import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assinaturaDoAvisoValida,
  mercadoPago,
  pagamentoDoAviso,
  renovarToken,
  situacaoDoMercadoPago,
  trocarCodigo,
  urlDeAutorizacao,
} from './mercado-pago'

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

describe('Mercado Pago, etapa B', () => {
  const acesso = { token: 'APP_USR-dono', ambiente: 'producao' as const }

  it('cria o Pix e o link com a mesma referência e chave de idempotência', async () => {
    const chamada = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1234,
            status: 'pending',
            transaction_amount: 50,
            point_of_interaction: { transaction_data: { qr_code: '000201pix', ticket_url: 'https://mp/ticket' } },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp/checkout' })))
    vi.stubGlobal('fetch', chamada)
    const criada = await mercadoPago.criarCobranca(acesso, {
      referencia: 'ref-1',
      valorCentavos: 5000,
      descricao: 'Mensalidade',
      venceEm: new Date('2026-10-23T21:00:00Z'),
      pagador: { nome: 'Ana Souza', documento: '52998224725', telefone: null, email: null },
    })
    expect(criada).toEqual({ pagamentoId: '1234', preferenciaId: 'pref-1', pixCopiaCola: '000201pix', link: 'https://mp/checkout' })
    const pix = chamada.mock.calls[0]![1] as RequestInit
    expect((pix.headers as Record<string, string>)['X-Idempotency-Key']).toBe('pix:ref-1')
    expect(JSON.parse(pix.body as string)).toMatchObject({
      transaction_amount: 50,
      payment_method_id: 'pix',
      external_reference: 'ref-1',
      date_of_expiration: '2026-10-23T18:00:00.000-03:00',
      payer: { first_name: 'Ana', last_name: 'Souza', identification: { type: 'CPF', number: '52998224725' } },
    })
    expect(JSON.parse((chamada.mock.calls[1]![1] as RequestInit).body as string)).toMatchObject({ external_reference: 'ref-1' })
  })

  it('aprovado é pago; recusado não cancela', () => {
    expect(situacaoDoMercadoPago('approved')).toBe('paga')
    expect(situacaoDoMercadoPago('rejected')).toBe('pendente')
    expect(situacaoDoMercadoPago('refunded')).toBe('estornada')
  })

  it('confere o x-signature e falha fechada sem segredo', () => {
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', 'assinatura-secreta')
    const manifesto = 'id:1234;request-id:req-9;ts:1700000000;'
    const v1 = createHmac('sha256', 'assinatura-secreta').update(manifesto).digest('hex')
    const entrada = { assinatura: `ts=1700000000,v1=${v1}`, requisicao: 'req-9', dataId: '1234' }
    expect(assinaturaDoAvisoValida(entrada)).toBe(true)
    expect(assinaturaDoAvisoValida({ ...entrada, dataId: '9999' })).toBe(false)
    vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', '')
    expect(assinaturaDoAvisoValida(entrada)).toBe(false)
  })

  it('do aviso saem a conta e o pagamento, e só de pagamento', () => {
    expect(pagamentoDoAviso({ type: 'payment', data: { id: '1234' }, user_id: 987 })).toEqual({ contaId: '987', pagamentoId: '1234' })
    expect(pagamentoDoAviso({ type: 'merchant_order', data: { id: '1' }, user_id: 9 })).toBeNull()
    expect(pagamentoDoAviso({ type: 'payment', data: { id: '../1' }, user_id: 9 })).toBeNull()
  })
})
