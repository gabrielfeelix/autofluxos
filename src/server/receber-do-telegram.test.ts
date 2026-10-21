import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./adaptador-do-canal', () => ({ adaptadorDoCanal: vi.fn() }))
vi.mock('./alertar', () => ({ alertar: vi.fn() }))
vi.mock('./receber-mensagem', () => ({ tratarUma: vi.fn() }))
vi.mock('./repos/conversas', () => ({ lerTokenDoCanal: vi.fn() }))
vi.mock('./repos/canais-telegram', () => ({ acharCanalPorBot: vi.fn() }))
vi.mock('./telegram/bot-api', () => ({ responderToque: vi.fn() }))

const { paraMensagemDoTelegram } = await import('./receber-do-telegram')

const chat = { id: 4242, type: 'private' }

describe('paraMensagemDoTelegram (0140)', () => {
  it('texto vira texto, com o chat como endereço e o nome de quem escreveu', () => {
    const r = paraMensagemDoTelegram({ update_id: 1, message: { message_id: 7, chat, from: { id: 4242, first_name: 'Ana', last_name: 'Lima' }, text: 'Oi' } })
    expect(r).toEqual({ nome: 'Ana Lima', mensagem: { id: 'tg-4242-7', from: '4242', type: 'text', text: { body: 'Oi' } } })
  })

  it('toque em botão vira resposta de botão com o id da opção', () => {
    const r = paraMensagemDoTelegram({
      update_id: 2,
      callback_query: { id: 'q1', from: { id: 4242, first_name: 'Ana' }, data: 'agendar', message: { message_id: 8, chat } },
    })
    expect(r?.mensagem).toMatchObject({ type: 'interactive', from: '4242', interactive: { button_reply: { id: 'agendar' } } })
  })

  it('foto vira texto que diz o que chegou, com a legenda', () => {
    const r = paraMensagemDoTelegram({ update_id: 3, message: { message_id: 9, chat, photo: [{}], caption: 'meu comprovante' } })
    expect(r?.mensagem).toMatchObject({ type: 'text', text: { body: '(mandou uma foto) meu comprovante' } })
  })

  it('grupo é ignorado', () => {
    expect(paraMensagemDoTelegram({ update_id: 4, message: { message_id: 1, chat: { id: -1, type: 'group' }, text: 'oi' } })).toBeNull()
  })
})
