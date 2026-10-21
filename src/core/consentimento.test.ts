import { describe, expect, it } from 'vitest'
import { ehPedidoDeSaida, fraseDoConsentimento, recebePromocoes } from './consentimento'

describe('ehPedidoDeSaida', () => {
  it('reconhece a palavra sozinha, em qualquer grafia', () => {
    for (const texto of ['SAIR', 'sair', ' Sair! ', 'PARAR', 'Stop', 'Parar promoções', 'STOP PROMOTIONS', 'descadastrar.']) {
      expect(ehPedidoDeSaida(texto)).toBe(true)
    }
  })

  it('não confunde conversa com pedido de saída', () => {
    for (const texto of ['quero sair às 8', 'cancelar', 'cancelar a aula', 'parar de fumar?', 'sair amanhã', '', null]) {
      expect(ehPedidoDeSaida(texto)).toBe(false)
    }
  })
})

describe('estado e frase', () => {
  it('sem registro recebe; recusa registrada não recebe', () => {
    expect(recebePromocoes(null)).toBe(true)
    expect(recebePromocoes({ aceito: false, origem: 'mensagem', em: '2026-10-21T12:00:00Z' })).toBe(false)
  })

  it('a linha do tempo se lê sozinha', () => {
    expect(fraseDoConsentimento(false, 'mensagem')).toBe('pediu para não receber promoções')
    expect(fraseDoConsentimento(true, 'site')).toBe('aceitou receber promoções pelo chat do site')
  })
})
