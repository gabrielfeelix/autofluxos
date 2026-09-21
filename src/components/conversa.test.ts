import { describe, expect, it } from 'vitest'
import { contarEventos, itensDoModo, type ItemDaConversa } from './conversa'

const itens: ItemDaConversa[] = [
  { chave: 1, de: 'bot', texto: 'Olá' },
  { chave: 2, de: 'sistema', texto: 'guardou nome = "Maria"' },
  { chave: 3, de: 'pessoa', texto: 'Oi' },
  { chave: 4, de: 'sistema', texto: 'conversa encerrada' },
  { chave: 5, de: 'sistema', texto: 'a conversa não respondeu (erro 401)', alerta: true },
]

describe('modos da conversa de teste', () => {
  it('esconde eventos do sistema na visualização da conversa', () => {
    expect(itensDoModo(itens, 'conversa').map((item) => item.chave)).toEqual([1, 3, 5])
  })

  /**
   * A trava do buraco que deixou a vitrine muda: o proxy recusava toda
   * mensagem, a tela escrevia o motivo, e este filtro o engolia antes da tela.
   * Silêncio é indistinguível de fluxo quebrado.
   */
  it('deixa o alerta passar: erro não é bastidor', () => {
    const so = itensDoModo(itens, 'conversa').filter((item) => item.de === 'sistema')
    expect(so).toHaveLength(1)
    expect(so[0]!.texto).toContain('401')
  })

  it('preserva todos os itens nos bastidores', () => {
    expect(itensDoModo(itens, 'bastidores')).toEqual(itens)
  })

  it('conta os eventos escondidos sem confundi-los com mensagens', () => {
    expect(contarEventos(itens)).toBe(3)
  })
})
