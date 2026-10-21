import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('./alertar', () => ({ alertar: vi.fn() }))
vi.mock('./db', () => ({ db: vi.fn(), ehIdInvalido: () => false }))
vi.mock('./repos/eventos', () => ({ anotar: vi.fn() }))
vi.mock('./repos/conversas', () => ({ lerTokenDoCanal: vi.fn() }))

const { payloadDaConversao } = await import('./conversoes-da-meta')

describe('payloadDaConversao', () => {
  const quando = new Date('2026-10-21T15:00:00Z')

  it('lead vai com o clique e a WABA, sem valor', () => {
    expect(payloadDaConversao({ evento: 'LeadSubmitted', wabaId: 'w1', clique: 'c1', quando })).toEqual({
      data: [
        {
          event_name: 'LeadSubmitted',
          event_time: 1792594800,
          action_source: 'business_messaging',
          messaging_channel: 'whatsapp',
          user_data: { whatsapp_business_account_id: 'w1', ctwa_clid: 'c1' },
        },
      ],
    })
  })

  it('venda leva o valor em reais', () => {
    const p = payloadDaConversao({ evento: 'Purchase', wabaId: 'w1', clique: 'c1', quando, valor: 349.9 }) as { data: { custom_data?: unknown }[] }
    expect(p.data[0]?.custom_data).toEqual({ currency: 'BRL', value: 349.9 })
  })
})
