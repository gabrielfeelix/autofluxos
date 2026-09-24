import { describe, expect, it } from 'vitest'
import { webhookSchema } from './receber-mensagem'

/**
 * O webhook de quem adotou nome de usuário no WhatsApp (2026).
 *
 * Payload copiado do exemplo da Meta: `from` e `contacts[].wa_id` **omitidos**,
 * só o BSUID em `from_user_id` e `user_id`. Com `from` obrigatório o parse do
 * lote inteiro falhava, e `receberMensagem` descartava a mensagem sem alerta.
 */
function payload(mensagem: Record<string, unknown>, contato: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
              contacts: [contato],
              messages: [mensagem],
            },
          },
        ],
      },
    ],
  }
}

describe('webhook sem telefone (BSUID)', () => {
  it('aceita a mensagem sem `from`, com o BSUID e o username', () => {
    const lido = webhookSchema.safeParse(
      payload(
        {
          from_user_id: 'US.13491208655302741918',
          id: 'wamid.X',
          timestamp: '1750000000',
          type: 'text',
          text: { body: 'Does it come in another color?' },
        },
        {
          profile: { name: 'Sheena Nelson', username: 'realsheenanelson' },
          user_id: 'US.13491208655302741918',
        },
      ),
    )
    expect(lido.success).toBe(true)
    const valor = lido.data!.entry[0]!.changes[0]!.value
    expect(valor.messages?.[0]?.from).toBeUndefined()
    expect(valor.messages?.[0]?.from_user_id).toBe('US.13491208655302741918')
    expect(valor.contacts?.[0]?.profile?.username).toBe('realsheenanelson')
  })

  it('lê a troca de BSUID da mensagem de sistema', () => {
    const lido = webhookSchema.parse(
      payload(
        {
          id: 'wamid.Y',
          type: 'system',
          system: {
            body: 'User changed from US.1 to US.2',
            user_id: 'US.2',
            previous_user_id: 'US.1',
            type: 'user_changed_user_id',
          },
        },
        { user_id: 'US.2' },
      ),
    )
    expect(lido.entry[0]!.changes[0]!.value.messages?.[0]?.system).toMatchObject({
      user_id: 'US.2',
      previous_user_id: 'US.1',
    })
  })
})
