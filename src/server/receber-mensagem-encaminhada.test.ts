import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { webhookSchema } from './receber-mensagem'

/*
 * A mensagem encaminhada chega com `context: { forwarded: true }` e sem `id`.
 * Com o `id` obrigatório o webhook inteiro falhava no parse e era descartado
 * calado: o áudio encaminhado da 4YU Tech (13/out/2026) nunca chegou.
 */
function webhookCom(mensagem: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '554474007438', phone_number_id: '123' },
              contacts: [{ profile: { name: 'Gabriel Felix' }, wa_id: '5544998775978' }],
              messages: [{ from: '5544998775978', id: 'wamid.X', timestamp: '1791908000', ...mensagem }],
            },
          },
        ],
      },
    ],
  }
}

describe('mensagem encaminhada', () => {
  it('aceita áudio encaminhado', () => {
    const r = webhookSchema.safeParse(
      webhookCom({
        type: 'audio',
        context: { forwarded: true },
        audio: { id: 'midia-1', mime_type: 'audio/ogg; codecs=opus', voice: true },
      }),
    )
    expect(r.success).toBe(true)
  })

  it('aceita áudio encaminhado muitas vezes', () => {
    const r = webhookSchema.safeParse(
      webhookCom({
        type: 'audio',
        context: { forwarded: true, frequently_forwarded: true },
        audio: { id: 'midia-1', mime_type: 'audio/ogg; codecs=opus' },
      }),
    )
    expect(r.success).toBe(true)
  })

  it('aceita texto e imagem encaminhados', () => {
    expect(webhookSchema.safeParse(webhookCom({ type: 'text', context: { forwarded: true }, text: { body: 'oi' } })).success).toBe(true)
    expect(
      webhookSchema.safeParse(webhookCom({ type: 'image', context: { forwarded: true }, image: { id: 'm', mime_type: 'image/jpeg' } })).success,
    ).toBe(true)
  })

  it('continua aceitando a resposta citada', () => {
    const r = webhookSchema.safeParse(
      webhookCom({ type: 'text', context: { from: '554474007438', id: 'wamid.CITADA' }, text: { body: 'sim' } }),
    )
    expect(r.success).toBe(true)
  })
})
