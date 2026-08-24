import { describe, expect, it } from 'vitest'
import { varsIniciais } from './vars-iniciais'

describe('varsIniciais', () => {
  it('o telefone é o do WhatsApp — sem ele, integração nenhuma reconhece ninguém', () => {
    expect(varsIniciais({ waId: '5544998887766' })).toEqual({ telefone: '5544998887766' })
  })

  it('o nome do perfil entra quando existe', () => {
    expect(varsIniciais({ waId: '55449', nome: 'Marina' })).toMatchObject({ nome: 'Marina' })
  })

  it('perfil em branco não vira variável vazia', () => {
    expect(varsIniciais({ waId: '55449', nome: '  ' })).not.toHaveProperty('nome')
  })

  it('o que a conversa guardou vence o que veio de fora', () => {
    const vars = varsIniciais({
      waId: '5544998887766',
      nome: 'Marina',
      campos: { telefone: '5511911112222', origem: 'anuncio' },
    })
    expect(vars.telefone).toBe('5511911112222')
    expect(vars.origem).toBe('anuncio')
  })

  // É o que alguém do time digitou olhando a conversa, porque o perfil dizia
  // "iPhone de Ana". É a informação mais confiável que existe ali.
  it('o nome corrigido por quem atende vence o perfil e o campo guardado', () => {
    const vars = varsIniciais({
      waId: '55449',
      nome: 'iPhone de Ana',
      nomeReal: 'Ana Paula',
      campos: { nome: 'ana' },
    })
    expect(vars.nome).toBe('Ana Paula')
  })
})
