import { describe, expect, it } from 'vitest'
import { webhookSchema } from './receber-mensagem'

/**
 * O que o webhook entende de reação e de citação.
 *
 * Puro de propósito, como `receber-mensagem-field.test.ts`: os testes de
 * `receber-mensagem.test.ts` exigem banco e são pulados sem credencial — que é
 * exatamente como um bug de parse chega à produção sem ninguém ver.
 *
 * O que estes provam é o parse e a regra. Que a reação **não acorda o motor**
 * mora em `tratarUma`, e aqui fica registrado o formato que aquela regra lê.
 */

/** Uma mensagem dentro do envelope que a Meta manda. */
function envelope(mensagem: Record<string, unknown>) {
  return {
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: '110549275215531' },
              contacts: [{ wa_id: '5544999', profile: { name: 'Maria' } }],
              messages: [mensagem],
            },
          },
        ],
      },
    ],
  }
}

function primeira(payload: unknown) {
  const lido = webhookSchema.parse(payload)
  return lido.entry[0]!.changes[0]!.value.messages![0]!
}

describe('a reação que chega', () => {
  it('lê o id da mensagem reagida e o emoji', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-da-reacao',
        from: '5544999',
        type: 'reaction',
        reaction: { message_id: 'wamid-alvo', emoji: '❤️' },
      }),
    )

    expect(mensagem.reaction).toEqual({ message_id: 'wamid-alvo', emoji: '❤️' })
  })

  /*
   * A remoção chega das duas formas — emoji vazio ou campo ausente — e as duas
   * significam a mesma coisa. Quem grava normaliza para string vazia; o schema
   * só não pode recusar nenhuma das duas.
   */
  it('aceita a remoção com emoji vazio', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-da-remocao',
        from: '5544999',
        type: 'reaction',
        reaction: { message_id: 'wamid-alvo', emoji: '' },
      }),
    )

    expect(mensagem.reaction?.emoji).toBe('')
  })

  it('aceita a remoção sem o campo emoji', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-da-remocao',
        from: '5544999',
        type: 'reaction',
        reaction: { message_id: 'wamid-alvo' },
      }),
    )

    expect(mensagem.reaction?.message_id).toBe('wamid-alvo')
    expect(mensagem.reaction?.emoji).toBeUndefined()
  })

  /*
   * A regra que conserta o bug: reação não faz a conversa andar.
   *
   * Antes disto ela caía no ramo de mídia e chegava ao motor como
   * `formato: 'reaction'`. Numa conversa parada numa pergunta, um "❤️"
   * respondia a pergunta — e ninguém entendia por quê.
   */
  it('reação é reconhecível antes de o motor ser chamado', () => {
    const reagiu = primeira(
      envelope({
        id: 'wamid-1',
        from: '5544999',
        type: 'reaction',
        reaction: { message_id: 'wamid-alvo', emoji: '👍' },
      }),
    )
    const escreveu = primeira(
      envelope({ id: 'wamid-2', from: '5544999', type: 'text', text: { body: 'oi' } }),
    )

    expect(Boolean(reagiu.reaction)).toBe(true)
    expect(Boolean(escreveu.reaction)).toBe(false)
  })
})

describe('a citação que chega', () => {
  it('lê o id da mensagem citada', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-1',
        from: '5544999',
        type: 'text',
        text: { body: 'pode ser terça' },
        context: { id: 'wamid-citada' },
      }),
    )

    expect(mensagem.context).toEqual({ id: 'wamid-citada' })
  })

  /*
   * A Meta manda mais campos em `context` (`from`, `forwarded`,
   * `referred_product`). O schema não é estrito de propósito: campo novo dela
   * não pode derrubar o parse de uma conversa inteira.
   */
  it('campo desconhecido no context não derruba o parse', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-1',
        from: '5544999',
        type: 'text',
        text: { body: 'oi' },
        context: { id: 'wamid-citada', from: '5511', forwarded: true },
      }),
    )

    expect(mensagem.context?.id).toBe('wamid-citada')
  })

  it('mensagem sem citação não ganha context', () => {
    const mensagem = primeira(
      envelope({ id: 'wamid-1', from: '5544999', type: 'text', text: { body: 'oi' } }),
    )

    expect(mensagem.context).toBeUndefined()
  })

  /*
   * Mídia cita igual. Se `context` só fosse lido em texto, citar uma foto
   * perderia a ligação em silêncio — o tipo de erro que só aparece em produção.
   */
  it('a foto também carrega a citação', () => {
    const mensagem = primeira(
      envelope({
        id: 'wamid-1',
        from: '5544999',
        type: 'image',
        image: { id: 'midia-1', caption: 'essa aqui' },
        context: { id: 'wamid-citada' },
      }),
    )

    expect(mensagem.context?.id).toBe('wamid-citada')
    expect(mensagem.image?.id).toBe('midia-1')
  })
})
