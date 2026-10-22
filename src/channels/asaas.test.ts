import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ambienteDaChave, asaas, avisoAutentico, pagamentoDoAviso, segredoDoAviso, situacaoDoAsaas, validarChave } from './asaas'

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste'))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const CHAVE_TESTE = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY'
const acesso = { token: CHAVE_TESTE, ambiente: 'teste' as const }

/** Responde por ordem de chamada; cada resposta é [status, corpo]. */
function respondendo(...respostas: [number, unknown][]) {
  const chamada = vi.fn()
  for (const [status, corpo] of respostas) chamada.mockResolvedValueOnce(new Response(JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', chamada)
  return chamada
}

const url = (chamada: ReturnType<typeof vi.fn>, i: number) => String(chamada.mock.calls[i]![0])
const init = (chamada: ReturnType<typeof vi.fn>, i: number) => chamada.mock.calls[i]![1] as RequestInit

describe('Asaas', () => {
  it('reconhece o ambiente pela chave', () => {
    expect(ambienteDaChave(CHAVE_TESTE)).toBe('teste')
    expect(ambienteDaChave('$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZm')).toBe('producao')
    expect(ambienteDaChave('$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZm')).toBe('desconhecido')
    expect(ambienteDaChave('sk_live_123')).toBeNull()
  })

  it('valida a chave no sandbox, com a chave no cabeçalho e User-Agent', async () => {
    const chamada = respondendo([200, { data: [{ id: 'carteira-1' }] }], [200, { tradingName: 'Pizzaria Teste', email: 'dono@x.test' }])
    const conta = await validarChave(CHAVE_TESTE)
    expect(conta).toEqual({ contaId: 'carteira-1', apelido: 'Pizzaria Teste', email: 'dono@x.test', ambiente: 'teste' })
    expect(url(chamada, 0)).toBe('https://api-sandbox.asaas.com/v3/wallets/')
    const cabecalhos = init(chamada, 0).headers as Record<string, string>
    expect(cabecalhos.access_token).toBe(CHAVE_TESTE)
    expect(cabecalhos['User-Agent']).toBeTruthy()
  })

  it('chave antiga sem ambiente tenta produção e cai no sandbox no 401', async () => {
    const chamada = respondendo(
      [401, { errors: [{ code: 'invalid_environment' }] }],
      [200, { data: [{ id: 'carteira-2' }] }],
      [200, {}],
    )
    const conta = await validarChave('$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZm')
    expect(conta.ambiente).toBe('teste')
    expect(url(chamada, 0)).toContain('https://api.asaas.com/v3/')
  })

  it('cria a cobrança: acha o cliente pelo CPF, pede Pix e link numa cobrança só', async () => {
    const chamada = respondendo(
      [200, { data: [{ id: 'cus_1' }] }],
      [200, { id: 'pay_1', status: 'PENDING', value: 109.8, invoiceUrl: 'https://sandbox.asaas.com/i/pay_1', externalReference: 'ref-1' }],
      [200, { payload: '00020126...6304ABCD', encodedImage: 'x' }],
    )
    const criada = await asaas.criarCobranca(acesso, {
      referencia: 'ref-1',
      valorCentavos: 10980,
      descricao: 'Pizza grande',
      venceEm: new Date('2026-10-23T15:00:00Z'),
      pagador: { nome: 'Ana', documento: '52998224725', telefone: '5544999990000', email: null },
    })
    expect(criada).toEqual({
      pagamentoId: 'pay_1',
      preferenciaId: null,
      pixCopiaCola: '00020126...6304ABCD',
      link: 'https://sandbox.asaas.com/i/pay_1',
    })
    expect(url(chamada, 0)).toContain('/customers?cpfCnpj=52998224725')
    const corpo = JSON.parse(init(chamada, 1).body as string)
    expect(corpo).toMatchObject({ customer: 'cus_1', billingType: 'UNDEFINED', value: 109.8, dueDate: '2026-10-23', externalReference: 'ref-1' })
  })

  it('cria o cliente quando não existe, sem notificação do Asaas', async () => {
    const chamada = respondendo(
      [200, { data: [] }],
      [200, { id: 'cus_novo' }],
      [200, { id: 'pay_2', status: 'PENDING', value: 10, invoiceUrl: 'https://x' }],
      [400, { errors: [{ code: 'invalid_action' }] }],
    )
    const criada = await asaas.criarCobranca(acesso, {
      referencia: 'ref-2',
      valorCentavos: 1000,
      descricao: 'Aula',
      venceEm: new Date(),
      pagador: { nome: 'Bia', documento: '52998224725', telefone: '5544999990000', email: null },
    })
    const corpo = JSON.parse(init(chamada, 1).body as string)
    expect(corpo).toMatchObject({ name: 'Bia', cpfCnpj: '52998224725', mobilePhone: '44999990000', notificationDisabled: true })
    // Sem chave Pix na conta: vale pelo link.
    expect(criada.pixCopiaCola).toBeNull()
    expect(criada.link).toBe('https://x')
  })

  it('sem documento não chama o Asaas', async () => {
    const chamada = respondendo()
    await expect(
      asaas.criarCobranca(acesso, {
        referencia: 'r',
        valorCentavos: 100,
        descricao: 'x',
        venceEm: new Date(),
        pagador: { nome: 'C', documento: null, telefone: null, email: null },
      }),
    ).rejects.toThrow('CPF ou CNPJ')
    expect(chamada).not.toHaveBeenCalled()
  })

  it('lê o pagamento na nossa língua, em centavos', async () => {
    respondendo([200, { id: 'pay_1', status: 'RECEIVED', value: 0.3, externalReference: 'ref-1', clientPaymentDate: '2026-10-22' }])
    const lido = await asaas.lerPagamento(acesso, 'pay_1')
    expect(lido).toMatchObject({ pagamentoId: 'pay_1', referencia: 'ref-1', situacao: 'paga', valorCentavos: 30 })
    expect(lido.pagaEm!.toISOString()).toBe('2026-10-22T15:00:00.000Z')
  })

  it('mapeia os status', () => {
    expect(situacaoDoAsaas('CONFIRMED')).toBe('paga')
    expect(situacaoDoAsaas('RECEIVED_IN_CASH')).toBe('paga')
    expect(situacaoDoAsaas('REFUNDED')).toBe('estornada')
    expect(situacaoDoAsaas('OVERDUE')).toBe('pendente')
    expect(situacaoDoAsaas('PENDING', true)).toBe('cancelada')
  })

  it('o erro não ecoa a descrição, que pode trazer dado da pessoa', async () => {
    respondendo([400, { errors: [{ code: 'invalid_cpfCnpj', description: 'CPF 529.982.247-25 inválido' }] }])
    await expect(asaas.lerPagamento(acesso, 'pay_1')).rejects.toThrow(/invalid_cpfCnpj\)$/)
  })

  it('o segredo do aviso é por organização e falha fechada sem o segredo do servidor', () => {
    expect(segredoDoAviso('a')).not.toBe(segredoDoAviso('b'))
    expect(segredoDoAviso('a').length).toBeGreaterThanOrEqual(32)
    expect(avisoAutentico('a', segredoDoAviso('a'))).toBe(true)
    expect(avisoAutentico('a', segredoDoAviso('b'))).toBe(false)
    expect(avisoAutentico('a', null)).toBe(false)
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect(avisoAutentico('a', '')).toBe(false)
  })

  it('do aviso só sai o id do pagamento, e só dos eventos que importam', () => {
    expect(pagamentoDoAviso({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', status: 'RECEIVED' } })).toBe('pay_1')
    expect(pagamentoDoAviso({ event: 'PAYMENT_CHECKOUT_VIEWED', payment: { id: 'pay_1' } })).toBeNull()
    expect(pagamentoDoAviso({ event: 'PAYMENT_RECEIVED' })).toBeNull()
    expect(pagamentoDoAviso('lixo')).toBeNull()
  })
})
