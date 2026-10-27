import { beforeAll, describe, expect, it } from 'vitest'
import { tokenDoWebhook, webhookAutentico } from './token-do-webhook'

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= 'segredo-de-teste-do-webhook'
})

const conta = '11111111-1111-4111-8111-111111111111'
const outra = '22222222-2222-4222-8222-222222222222'

describe('token do webhook de cardápio', () => {
  it('o token da conta passa; o de outra conta ou plataforma, não', () => {
    const token = tokenDoWebhook(conta, 'cardapio_web')
    expect(webhookAutentico(conta, 'cardapio_web', token)).toBe(true)
    expect(webhookAutentico(outra, 'cardapio_web', token)).toBe(false)
    expect(webhookAutentico(conta, 'olaclick', token)).toBe(false)
  })

  it('sem cabeçalho não passa', () => {
    expect(webhookAutentico(conta, 'cardapio_web', null)).toBe(false)
    expect(webhookAutentico(conta, 'cardapio_web', '')).toBe(false)
  })
})
