import { describe, expect, it } from 'vitest'
import { contarEventos, itensDoModo, type ItemDaConversa } from './conversa'

const itens: ItemDaConversa[] = [
  { chave: 1, de: 'bot', texto: 'Olá' },
  { chave: 2, de: 'sistema', texto: 'guardou nome = "Maria"' },
  { chave: 3, de: 'pessoa', texto: 'Oi' },
  { chave: 4, de: 'sistema', texto: 'conversa encerrada' },
]

describe('modos da conversa de teste', () => {
  it('esconde eventos do sistema na visualização da conversa', () => {
    expect(itensDoModo(itens, 'conversa').map((item) => item.chave)).toEqual([1, 3])
  })

  it('preserva todos os itens nos bastidores', () => {
    expect(itensDoModo(itens, 'bastidores')).toEqual(itens)
  })

  it('conta os eventos escondidos sem confundi-los com mensagens', () => {
    expect(contarEventos(itens)).toBe(2)
  })
})
