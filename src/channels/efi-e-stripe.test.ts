import { createHmac, generateKeyPairSync } from 'node:crypto'
import forge from 'node-forge'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conectarEfi, efi, lerCertificado, pagamentoDoAvisoDaEfi, transporte, txidDaReferencia } from './efi'
import { ErroDeConexao } from './pagamento'
import { assinaturaValida, eventoDoAviso, formulario, stripe, urlDeAutorizacao } from './stripe'

const CLIENTE = '11111111-2222-4333-8444-555555555555'
const REF = '5d0c1e2f-0000-4000-8000-000000000001'
const pedido = {
  referencia: REF,
  clienteId: CLIENTE,
  valorCentavos: 5900,
  descricao: 'Aula avulsa',
  venceEm: new Date(Date.now() + 3_600_000),
  pagador: { nome: 'Ana Souza', documento: '01234567890', telefone: '5544999990000', email: null },
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste')
  vi.stubEnv('VERCEL_ENV', 'production')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Um .p12 no formato antigo (3DES), como a Efí entrega e o Node 24 recusa. */
function p12DeTeste(venceEmDias = 365): string {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
  const chave = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }).toString())
  const cert = forge.pki.createCertificate()
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }).toString())
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() - 86_400_000)
  cert.validity.notAfter = new Date(Date.now() + venceEmDias * 86_400_000)
  cert.setSubject([{ name: 'commonName', value: 'teste' }])
  cert.setIssuer([{ name: 'commonName', value: 'teste' }])
  cert.sign(chave)
  const asn1 = forge.pkcs12.toPkcs12Asn1(chave, [cert], '', { algorithm: '3des' })
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary').toString('base64')
}

const valoresEfi = (certificado: string) => ({
  clienteId: 'Client_Id_abcdef1234567890',
  segredo: 'Client_Secret_abcdef1234567890',
  chave: 'financeiro@empresa.com.br',
  certificado,
})

describe('Efí', () => {
  it('lê o .p12 antigo e devolve PEM e vencimento', () => {
    const lido = lerCertificado(p12DeTeste())
    expect(lido.certificado).toMatch(/BEGIN CERTIFICATE/)
    expect(lido.chavePrivada).toMatch(/BEGIN RSA PRIVATE KEY/)
    expect(lido.venceEm.getTime()).toBeGreaterThan(Date.now())
    expect(() => lerCertificado(Buffer.from('lixo').toString('base64'))).toThrow(ErroDeConexao)
  })

  it('conecta em produção e cadastra o aviso pulando o mTLS, com o segredo no endereço', async () => {
    const pedir = vi.spyOn(transporte, 'pedir').mockImplementation(async (url) => {
      if (url.endsWith('/oauth/token')) return { status: 200, ok: true, json: { access_token: 'tok' } }
      return { status: 201, ok: true, json: {} }
    })
    const c = await conectarEfi(valoresEfi(p12DeTeste()), CLIENTE)
    expect(c).toMatchObject({ ambiente: 'producao', contaNoGateway: 'financeiro@empresa.com.br', avisoNoGateway: 'financeiro@empresa.com.br' })
    expect(JSON.parse(c.token)).toMatchObject({ clienteId: 'Client_Id_abcdef1234567890', chave: 'financeiro@empresa.com.br' })
    const cadastro = pedir.mock.calls.find(([url]) => url.includes('/v2/webhook/'))!
    expect(cadastro[0]).toBe('https://pix.api.efipay.com.br/v2/webhook/financeiro%40empresa.com.br')
    expect(cadastro[1].headers).toMatchObject({ 'x-skip-mtls-checking': 'true' })
    expect(JSON.parse(cadastro[1].body!).webhookUrl).toMatch(/\/api\/webhook\/pagamento\/efi\/.+\?t=.+&ignorar=$/)
  })

  it('recusada em produção e em homologação, erro para a tela; certificado vencido nem tenta', async () => {
    vi.spyOn(transporte, 'pedir').mockResolvedValue({ status: 401, ok: false, json: {} })
    await expect(conectarEfi(valoresEfi(p12DeTeste()), CLIENTE)).rejects.toBeInstanceOf(ErroDeConexao)
    await expect(conectarEfi(valoresEfi(p12DeTeste(-1)), CLIENTE)).rejects.toThrow(/venceu/)
  })

  it('cob com o txid da referência, valor em reais com centavos e a chave da conta', async () => {
    const cred = { clienteId: 'a', segredo: 'b', chave: 'financeiro@empresa.com.br', certificado: 'c', chavePrivada: 'd' }
    const pedir = vi.spyOn(transporte, 'pedir').mockImplementation(async (url) =>
      url.endsWith('/oauth/token')
        ? { status: 200, ok: true, json: { access_token: 'tok' } }
        : { status: 201, ok: true, json: { txid: txidDaReferencia(REF), status: 'ATIVA', valor: { original: '59.00' }, pixCopiaECola: '000201efi' } },
    )
    const criada = await efi.criarCobranca({ token: JSON.stringify(cred), ambiente: 'producao' }, pedido)
    expect(criada).toEqual({ pagamentoId: '5d0c1e2f000040008000000000000001', preferenciaId: null, pixCopiaCola: '000201efi', link: null })
    const [url, init] = pedir.mock.calls[1]!
    expect(url).toBe('https://pix.api.efipay.com.br/v2/cob/5d0c1e2f000040008000000000000001')
    expect(JSON.parse(init.body!)).toMatchObject({ valor: { original: '59.00' }, chave: 'financeiro@empresa.com.br', devedor: { cpf: '01234567890' } })
  })

  it('relê: CONCLUIDA com Pix recebido é paga, devolvido é estornada, e a referência volta do txid', async () => {
    const cred = JSON.stringify({ clienteId: 'a', segredo: 'b', chave: 'k', certificado: 'c', chavePrivada: 'd' })
    const txid = txidDaReferencia(REF)
    const cob = (extra: object) =>
      vi.spyOn(transporte, 'pedir').mockImplementation(async (url) =>
        url.endsWith('/oauth/token')
          ? { status: 200, ok: true, json: { access_token: 'tok' } }
          : { status: 200, ok: true, json: { txid, status: 'CONCLUIDA', valor: { original: '59.00' }, ...extra } },
      )
    cob({ pix: [{ valor: '59.00', horario: '2026-10-23T13:00:00Z' }] })
    expect(await efi.lerPagamento({ token: cred, ambiente: 'producao' }, txid)).toMatchObject({ situacao: 'paga', referencia: REF, valorCentavos: 5900 })
    vi.restoreAllMocks()
    cob({ pix: [{ valor: '59.00', devolucoes: [{ status: 'DEVOLVIDO' }] }] })
    expect((await efi.lerPagamento({ token: cred, ambiente: 'producao' }, txid)).situacao).toBe('estornada')
  })

  it('do aviso, só o txid; o teste do cadastro cai fora', () => {
    expect(pagamentoDoAvisoDaEfi({ pix: [{ txid: '5d0c1e2f000040008000000000000001', valor: '59.00' }] })).toBe('5d0c1e2f000040008000000000000001')
    expect(pagamentoDoAvisoDaEfi({ evento: 'teste_webhook' })).toBeNull()
  })
})

describe('Stripe', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_plataforma')
    vi.stubEnv('STRIPE_CONNECT_CLIENT_ID', 'ca_123')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_teste')
  })

  it('o formulário aninhado como o Stripe lê', () => {
    expect(formulario({ a: 1, b: { c: 'x', d: [{ e: 2 }, 'f'] }, z: undefined }).toString()).toBe('a=1&b%5Bc%5D=x&b%5Bd%5D%5B0%5D%5Be%5D=2&b%5Bd%5D%5B1%5D=f')
  })

  it('autorização com read_write e o retorno do endereço', () => {
    const url = new URL(urlDeAutorizacao({ origem: 'https://autofluxos.4yu.com.br', estado: 'bilhete' }))
    expect(url.origin + url.pathname).toBe('https://connect.stripe.com/oauth/authorize')
    expect(url.searchParams.get('scope')).toBe('read_write')
    expect(url.searchParams.get('redirect_uri')).toBe('https://autofluxos.4yu.com.br/api/pagamentos/stripe/retorno')
  })

  it('assinatura: certa passa; errada, velha ou sem segredo, não', () => {
    const corpo = '{"id":"evt_1"}'
    const t = Math.floor(Date.now() / 1_000)
    const v1 = createHmac('sha256', 'whsec_teste').update(`${t}.${corpo}`).digest('hex')
    expect(assinaturaValida(corpo, `t=${t},v1=${v1}`)).toBe(true)
    expect(assinaturaValida(corpo, `t=${t},v1=${'0'.repeat(64)}`)).toBe(false)
    expect(assinaturaValida(corpo, `t=${t - 600},v1=${v1}`)).toBe(false)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect(assinaturaValida(corpo, `t=${t},v1=${v1}`)).toBe(false)
  })

  it('do evento saem a conta, o tipo e o id', () => {
    expect(eventoDoAviso({ type: 'payment_intent.succeeded', account: 'acct_1234567890', data: { object: { id: 'pi_1234567890abcdef' } } })).toEqual({
      conta: 'acct_1234567890',
      tipo: 'payment_intent.succeeded',
      objetoId: 'pi_1234567890abcdef',
    })
    expect(eventoDoAviso({ type: 'x', data: { object: {} } })).toBeNull()
  })

  it('cobra com Pix e link na conta do dono; Pix recusado, sai só com o link', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/payment_intents'))
        return new Response(JSON.stringify({ id: 'pi_1234567890abcdef', status: 'requires_action', amount: 5900, next_action: { pix_display_qr_code: { data: '000201st' } } }))
      return new Response(JSON.stringify({ id: 'cs_test_1234567890', url: 'https://checkout.stripe.com/c/pay/x' }))
    })
    vi.stubGlobal('fetch', fetch)
    const criada = await stripe.criarCobranca({ token: 'acct_1234567890', ambiente: 'teste' }, pedido)
    expect(criada).toEqual({ pagamentoId: 'pi_1234567890abcdef', preferenciaId: 'cs_test_1234567890', pixCopiaCola: '000201st', link: 'https://checkout.stripe.com/c/pay/x' })
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test_plataforma', 'Stripe-Account': 'acct_1234567890' })
    expect(String(init.body)).toContain('payment_method_data%5Bbilling_details%5D%5Btax_id%5D=01234567890')

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/payment_intents') ? new Response('{}', { status: 400 }) : new Response(JSON.stringify({ id: 'cs_test_1234567890', url: 'https://checkout.stripe.com/c/pay/x' })),
      ),
    )
    const soLink = await stripe.criarCobranca({ token: 'acct_1234567890', ambiente: 'teste' }, pedido)
    expect(soLink).toMatchObject({ pagamentoId: 'cs_test_1234567890', pixCopiaCola: null })
  })

  it('relê o PaymentIntent: pago, e estornado pela cobrança', async () => {
    const pi = (latest: object) =>
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'pi_1234567890abcdef', status: 'succeeded', amount: 5900, amount_received: 5900, metadata: { referencia: REF }, latest_charge: latest }))))
    pi({ created: 1_761_000_000, refunded: false })
    expect(await stripe.lerPagamento({ token: 'acct_1', ambiente: 'teste' }, 'pi_1234567890abcdef')).toMatchObject({ situacao: 'paga', referencia: REF, valorCentavos: 5900 })
    pi({ created: 1_761_000_000, refunded: true })
    expect((await stripe.lerPagamento({ token: 'acct_1', ambiente: 'teste' }, 'pi_1234567890abcdef')).situacao).toBe('estornada')
  })
})
