import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  avisoAutentico,
  clienteDoEndereco,
  dataDoPagBank,
  enderecoDoAviso,
  enderecoDoCliente,
  estadoDoPagBank,
  pagbank,
  pedidoDoAviso,
  renovarToken,
  segredoDoAviso,
  situacaoDoPedido,
  stateDoPagBank,
  telefoneDoPagBank,
  trocarCodigo,
  urlDeAutorizacao,
} from './pagbank'

const acesso = { token: 'token-do-dono', ambiente: 'producao' as const }
const CLIENTE = '11111111-2222-4333-8444-555555555555'
const PEDIDO = 'ORDE_95E5B39B-5743-4272-93EB-689A8294E916'
const pedido = {
  referencia: '5d0c1e2f-0000-4000-8000-000000000001',
  clienteId: CLIENTE,
  valorCentavos: 5900,
  descricao: 'Aula avulsa',
  venceEm: new Date('2026-10-30T15:00:00Z'),
  pagador: { nome: 'Ana Souza', documento: '01234567890', telefone: '5544999990000', email: null },
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('PAGBANK_CLIENT_ID', 'cliente-da-4yu')
  vi.stubEnv('PAGBANK_CLIENT_SECRET', 'segredo-da-4yu')
  vi.stubEnv('PAGBANK_TOKEN', 'token-da-4yu')
  vi.stubEnv('PAGBANK_SANDBOX', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const responder = (json: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(json), { status }))

const pago = {
  id: PEDIDO,
  reference_id: pedido.referencia,
  qr_codes: [{ text: '00020101...' }],
  charges: [
    {
      status: 'PAID',
      paid_at: '2026-10-23T22:18:38.835-03:00',
      amount: { value: 5900, summary: { total: 5900, paid: 5900, refunded: 0 } },
    },
  ],
}

describe('o state do OAuth', () => {
  it('sai só com letra e número, até 128, e volta igual', () => {
    const estado = `${CLIENTE}.1761250000000.${Buffer.alloc(32, 7).toString('base64url')}`
    const state = stateDoPagBank(estado)
    expect(state).toMatch(/^[0-9a-zA-Z]{1,128}$/)
    expect(estadoDoPagBank(state)).toBe(estado)
  })
  it('recusa o que não veio daqui', () => {
    expect(estadoDoPagBank(null)).toBeNull()
    expect(estadoDoPagBank('abc')).toBeNull()
    expect(estadoDoPagBank(`${CLIENTE}.1.abc`)).toBeNull()
  })
  it('monta a autorização com os escopos separados por +', () => {
    const url = urlDeAutorizacao({ origem: 'https://autofluxos.4yu.com.br', estado: `${CLIENTE}.1.AAAA` })
    expect(url.startsWith('https://connect.pagbank.com.br/oauth2/authorize?')).toBe(true)
    expect(url).toContain('scope=payments.read+payments.create+checkout.create+accounts.read')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fautofluxos.4yu.com.br%2Fapi%2Fpagamentos%2Fpagbank%2Fretorno')
  })
  it('vai para o sandbox com PAGBANK_SANDBOX=1', () => {
    vi.stubEnv('PAGBANK_SANDBOX', '1')
    expect(urlDeAutorizacao({ origem: 'http://localhost:3000', estado: `${CLIENTE}.1.AAAA` })).toMatch(
      /^https:\/\/connect\.sandbox\.pagbank\.com\.br\//,
    )
  })
})

describe('o token', () => {
  it('troca o code com as três credenciais da 4YU e lê a validade da resposta', async () => {
    const fetch = responder({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: '86400',
      account_id: 'ACCO_737348328392943',
      token_type: 'bearer',
    })
    vi.stubGlobal('fetch', fetch)
    const antes = Date.now()
    const token = await trocarCodigo({ codigo: 'c0d3', origem: 'https://autofluxos.4yu.com.br' })
    expect(token).toMatchObject({ token: 'a', renovacao: 'r', contaId: 'ACCO_737348328392943', ambiente: 'producao' })
    expect(token.expiraEm!.getTime() - antes).toBeGreaterThanOrEqual(86_400_000 - 1_000)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.pagseguro.com/oauth2/token')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token-da-4yu',
      X_CLIENT_ID: 'cliente-da-4yu',
      X_CLIENT_SECRET: 'segredo-da-4yu',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'c0d3',
      redirect_uri: 'https://autofluxos.4yu.com.br/api/pagamentos/pagbank/retorno',
    })
  })
  it('renova no ambiente da conexão', async () => {
    const fetch = responder({ access_token: 'b', refresh_token: 'r2', expires_in: 3600, account_id: 'ACCO_1' }, 201)
    vi.stubGlobal('fetch', fetch)
    const token = await renovarToken('r', 'teste')
    expect(token).toMatchObject({ token: 'b', renovacao: 'r2', ambiente: 'teste' })
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://sandbox.api.pagseguro.com/oauth2/refresh')
  })
  it('não ecoa o corpo do erro', async () => {
    vi.stubGlobal('fetch', responder({ error_messages: [{ description: 'segredo-da-4yu inválido' }] }, 401))
    await expect(trocarCodigo({ codigo: 'x', origem: 'https://a.b' })).rejects.toThrow('o PagBank recusou o pedido de token (401)')
  })
})

describe('o aviso', () => {
  it('o endereço cabe em 100 caracteres e devolve a organização', () => {
    const endereco = enderecoDoAviso(CLIENTE)!
    expect(endereco.length).toBeLessThanOrEqual(100)
    const [, curto] = endereco.match(/\/pagbank\/([^?]+)\?t=/)!
    expect(clienteDoEndereco(curto!)).toBe(CLIENTE)
    expect(enderecoDoCliente(CLIENTE)).toBe(curto)
  })
  it('sai sem aviso quando o endereço passaria de 100', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('BETTER_AUTH_URL', 'https://autofluxos-git-uma-branch-com-nome-comprido-4-yu.vercel.app')
    expect(enderecoDoAviso(CLIENTE)).toBeNull()
  })
  it('o segredo é por organização, e sem BETTER_AUTH_SECRET nada passa', () => {
    expect(avisoAutentico(CLIENTE, segredoDoAviso(CLIENTE))).toBe(true)
    expect(avisoAutentico(CLIENTE, segredoDoAviso('99999999-2222-4333-8444-555555555555'))).toBe(false)
    expect(avisoAutentico(CLIENTE, null)).toBe(false)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect(avisoAutentico(CLIENTE, '')).toBe(false)
  })
  it('do corpo só sai o id do pedido', () => {
    expect(pedidoDoAviso(pago)).toBe(PEDIDO)
    expect(pedidoDoAviso({ id: 'ORDE_../../x' })).toBeNull()
    expect(pedidoDoAviso('lixo')).toBeNull()
    expect(clienteDoEndereco('curto')).toBeNull()
  })
})

describe('criarCobranca', () => {
  it('cria o pedido com QR Pix na conta do dono, em centavos, vencendo junto, com o aviso', async () => {
    const fetch = responder({ id: PEDIDO, reference_id: pedido.referencia, qr_codes: [{ text: '00020101pix' }], charges: [] }, 201)
    vi.stubGlobal('fetch', fetch)
    const criada = await pagbank.criarCobranca(acesso, pedido)
    expect(criada).toEqual({ pagamentoId: PEDIDO, preferenciaId: null, pixCopiaCola: '00020101pix', link: null })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.pagseguro.com/orders')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-do-dono', 'x-idempotency-key': pedido.referencia })
    const corpo = JSON.parse(String(init.body))
    expect(corpo.reference_id).toBe(pedido.referencia)
    expect(corpo.customer).toEqual({
      name: 'Ana Souza',
      email: 'pagador@autofluxos.4yu.com.br',
      tax_id: '01234567890',
      phones: [{ country: '55', area: '44', number: '999990000', type: 'MOBILE' }],
    })
    expect(corpo.qr_codes).toEqual([{ amount: { value: 5900 }, expiration_date: '2026-10-30T12:00:00-03:00' }])
    expect(corpo.items[0]).toMatchObject({ quantity: 1, unit_amount: 5900 })
    expect(corpo.notification_urls).toEqual([enderecoDoAviso(CLIENTE)])
  })
  it('não cria sem CPF ou CNPJ', async () => {
    vi.stubGlobal('fetch', responder({}))
    await expect(pagbank.criarCobranca(acesso, { ...pedido, pagador: { ...pedido.pagador, documento: null } })).rejects.toThrow(
      'CPF ou CNPJ',
    )
  })
  it('falha quando o PagBank não devolve o QR', async () => {
    vi.stubGlobal('fetch', responder({ id: PEDIDO, qr_codes: [] }, 201))
    await expect(pagbank.criarCobranca(acesso, pedido)).rejects.toThrow()
  })
})

describe('lerPagamento', () => {
  it('relê o pedido com o token do dono e diz pago', async () => {
    const fetch = responder(pago)
    vi.stubGlobal('fetch', fetch)
    const lido = await pagbank.lerPagamento(acesso, PEDIDO)
    expect(lido).toEqual({
      pagamentoId: PEDIDO,
      referencia: pedido.referencia,
      situacao: 'paga',
      valorCentavos: 5900,
      pagaEm: new Date('2026-10-23T22:18:38.835-03:00'),
    })
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe(`https://api.pagseguro.com/orders/${PEDIDO}`)
  })
  it('recusa id que não é de pedido sem chamar a API', async () => {
    const fetch = responder(pago)
    vi.stubGlobal('fetch', fetch)
    await expect(pagbank.lerPagamento(acesso, '../accounts/x')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('situacaoDoPedido', () => {
  it('sem cobrança é pendente; recusada também, que o QR ainda pode ser pago', () => {
    expect(situacaoDoPedido({ charges: [] }).situacao).toBe('pendente')
    expect(situacaoDoPedido({ charges: null }).situacao).toBe('pendente')
    expect(situacaoDoPedido({ charges: [{ status: 'DECLINED', amount: { value: 5900 } }] }).situacao).toBe('pendente')
  })
  it('cancelada com devolução é estornada', () => {
    expect(situacaoDoPedido({ charges: [{ status: 'CANCELED', amount: { value: 5900, summary: { refunded: 5900 } } }] }).situacao).toBe(
      'estornada',
    )
  })
})

describe('formatos', () => {
  it('telefone do Brasil em três partes, o resto fica de fora', () => {
    expect(telefoneDoPagBank('5511987654321')).toEqual({ country: '55', area: '11', number: '987654321', type: 'MOBILE' })
    expect(telefoneDoPagBank('14155550100')).toBeNull()
    expect(telefoneDoPagBank(null)).toBeNull()
  })
  it('data com o fuso de Brasília escrito', () => {
    expect(dataDoPagBank(new Date('2026-10-31T02:59:59Z'))).toBe('2026-10-30T23:59:59-03:00')
  })
})
