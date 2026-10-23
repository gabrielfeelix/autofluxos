import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { segredoDoAviso } from './asaas'
import {
  acessoDa4yu,
  avisoDa4yuAutentico,
  estadoDaFatura,
  garantirAviso,
  pagamentoDoAvisoDa4yu,
  paraFaturaLida,
  segredoDoAvisoDa4yu,
} from './asaas-da-4yu'

const CHAVE_TESTE = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY'

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'segredo-de-teste')
  vi.stubEnv('ASAAS_4YU_CHAVE', CHAVE_TESTE)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('acessoDa4yu', () => {
  it('lê o ambiente da chave', () => {
    expect(acessoDa4yu()).toEqual({ token: CHAVE_TESTE, ambiente: 'teste' })
  })

  it('sem chave, falha em vez de cobrar no escuro', () => {
    vi.stubEnv('ASAAS_4YU_CHAVE', '')
    expect(() => acessoDa4yu()).toThrow('ASAAS_4YU_CHAVE')
  })
})

describe('o aviso da mensalidade', () => {
  it('aceita só o próprio segredo, e não o de uma organização', () => {
    expect(avisoDa4yuAutentico(segredoDoAvisoDa4yu())).toBe(true)
    expect(avisoDa4yuAutentico(segredoDoAviso('11111111-1111-1111-1111-111111111111'))).toBe(false)
    expect(avisoDa4yuAutentico(null)).toBe(false)
  })

  it('tira só o id do pagamento, e só de evento conhecido', () => {
    expect(pagamentoDoAvisoDa4yu({ event: 'PAYMENT_OVERDUE', payment: { id: 'pay_1' } })).toBe('pay_1')
    expect(pagamentoDoAvisoDa4yu({ event: 'ACCOUNT_STATUS_UPDATED', payment: { id: 'pay_1' } })).toBeNull()
    expect(pagamentoDoAvisoDa4yu({ event: 'PAYMENT_RECEIVED' })).toBeNull()
  })

  it('não cadastra o aviso de novo quando ele já existe', async () => {
    const chamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        chamadas.push(`${init.method} ${url}`)
        return new Response(JSON.stringify({ data: [{ id: 'w1', url: 'https://af.test/api/webhook/assinatura' }] }))
      }),
    )
    await garantirAviso('https://af.test/', 'contato@4yu.com.br')
    expect(chamadas).toEqual(['GET https://api-sandbox.asaas.com/v3/webhooks?limit=100'])
  })
})

describe('a fatura', () => {
  it('vencida é estado próprio, separado de pendente', () => {
    expect(estadoDaFatura('PENDING')).toBe('pendente')
    expect(estadoDaFatura('OVERDUE')).toBe('vencida')
    expect(estadoDaFatura('RECEIVED')).toBe('paga')
    expect(estadoDaFatura('REFUNDED')).toBe('estornada')
    expect(estadoDaFatura('RECEIVED', true)).toBe('cancelada')
  })

  it('lê a fatura da assinatura com data de pagamento no dia certo', () => {
    const lida = paraFaturaLida({
      id: 'pay_1',
      customer: 'cus_1',
      subscription: 'sub_1',
      status: 'CONFIRMED',
      value: 197,
      dueDate: '2026-10-23',
      invoiceUrl: 'https://sandbox.asaas.com/i/1',
      confirmedDate: '2026-10-23',
    })
    expect(lida).toMatchObject({ asaasId: 'pay_1', assinaturaRef: 'sub_1', estado: 'paga', valorCentavos: 19700 })
    expect(lida.pagaEm?.toISOString()).toBe('2026-10-23T15:00:00.000Z')
  })
})
