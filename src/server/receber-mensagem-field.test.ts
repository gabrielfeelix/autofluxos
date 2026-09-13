import { describe, expect, it } from 'vitest'
import { webhookSchema } from './receber-mensagem'

/**
 * O filtro por `field`, e o bug que ele fecha.
 *
 * Em 13/set/2026 `receberMensagem` não olhava o `field` do webhook. O eco de
 * coexistência (`smb_message_echoes`) — o que o dono do negócio manda pelo
 * **celular dele** — tem exatamente a forma de uma mensagem recebida:
 * `metadata.phone_number_id` e um `messages[]` com `id`, `from` e `type`.
 *
 * O resultado era o pior possível para este produto: o `from` do eco é o número
 * **do próprio negócio**, então virava um contato novo, a mensagem entrava como
 * `entrada`, e o motor respondia. O dono recebia resposta automática do próprio
 * bot — o atropelo que a coexistência existe para impedir.
 *
 * Estes testes são puros (só o schema e a regra) de propósito: os de
 * `receber-mensagem.test.ts` exigem banco e são pulados sem credencial, que é
 * justamente como o bug passou.
 */

/** A mesma regra do laço de `receberMensagem`. */
function deveTratar(field: string | undefined): boolean {
  return field === undefined || field === 'messages'
}

describe('o filtro por field', () => {
  it('aceita `messages`, que é o que o bot responde', () => {
    expect(deveTratar('messages')).toBe(true)
  })

  it('**recusa `smb_message_echoes`** — é o dono falando pelo celular', () => {
    expect(deveTratar('smb_message_echoes')).toBe(false)
  })

  it('recusa os outros campos de coexistência', () => {
    expect(deveTratar('history')).toBe(false)
    expect(deveTratar('smb_app_state_sync')).toBe(false)
  })

  it('trata a ausência como `messages`', () => {
    // Quando os payloads de teste foram escritos, era o único campo que chegava
    // aqui. Recusar o ausente quebraria todos eles de uma vez.
    expect(deveTratar(undefined)).toBe(true)
  })
})

describe('o eco passa pelo schema — por isso o filtro é necessário', () => {
  /**
   * O payload que causava o estrago, reduzido ao que importa. Se um dia o
   * schema deixar de aceitá-lo, este teste falha e avisa que a proteção mudou
   * de lugar — o que é exatamente o que se quer saber.
   */
  const eco = {
    entry: [
      {
        changes: [
          {
            field: 'smb_message_echoes',
            value: {
              metadata: { phone_number_id: '1301107846409860' },
              // `from` é o **número do negócio**: quem falou foi o dono.
              messages: [
                { id: 'wamid.ECO', from: '5544740074381', type: 'text', timestamp: '1789000000' },
              ],
            },
          },
        ],
      },
    ],
  }

  it('o schema aceita o eco, então só o `field` o separa', () => {
    const lido = webhookSchema.safeParse(eco)
    expect(lido.success).toBe(true)

    const mudanca = lido.success ? lido.data.entry[0]?.changes[0] : undefined
    // As duas coisas que enganavam o laço antigo.
    expect(mudanca?.value.metadata?.phone_number_id).toBe('1301107846409860')
    expect(mudanca?.value.messages?.length).toBe(1)

    // E a que o separa agora.
    expect(deveTratar(mudanca?.field)).toBe(false)
  })

  it('uma mensagem de verdade continua passando', () => {
    const recebida = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '1301107846409860' },
                messages: [
                  { id: 'wamid.REAL', from: '554499990000', type: 'text', timestamp: '1789000000' },
                ],
              },
            },
          ],
        },
      ],
    }

    const lido = webhookSchema.safeParse(recebida)
    expect(lido.success).toBe(true)
    expect(deveTratar(lido.success ? lido.data.entry[0]?.changes[0]?.field : undefined)).toBe(true)
  })
})
