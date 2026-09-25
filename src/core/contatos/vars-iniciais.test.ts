import { describe, expect, it } from 'vitest'
import { primeiroNome, varsIniciais } from './vars-iniciais'

describe('varsIniciais', () => {
  it('o telefone é o do WhatsApp, sem ele, integração nenhuma reconhece ninguém', () => {
    expect(varsIniciais({ waId: '5544998887766' })).toEqual({
      telefone: '5544998887766',
      telefone_br: '+55 (44) 99888-7766',
    })
  })

  /*
   * Dois, e não um formatado: `{{telefone}}` vai no corpo JSON dos presets e é
   * por ele que a agenda acha a pessoa, então máscara ali casaria a busca com
   * nada. `{{telefone_br}}` existe para a frase que a pessoa lê.
   */
  it('o telefone legível é derivado, e o cru continua cru', () => {
    const vars = varsIniciais({ waId: '5511911001414' })
    expect(vars.telefone).toBe('5511911001414')
    expect(vars.telefone_br).toBe('+55 (11) 91100-1414')
  })

  // Mesmo critério de `telefoneLegivel`: o que não é telefone brasileiro
  // atravessa como está, em vez de ganhar uma máscara que mentiria sobre ele.
  it('número que não dá para formatar atravessa inteiro', () => {
    expect(varsIniciais({ waId: '12025550123' }).telefone_br).toBe('12025550123')
  })

  it('o nome do perfil entra quando existe', () => {
    expect(varsIniciais({ waId: '55449', nome: 'Marina' })).toMatchObject({ nome: 'Marina' })
  })

  // O menu da PCYES chamou alguém de "Eduardo Yamamoto | Gestor de Growth".
  it('do perfil fica só o primeiro nome, sem cargo nem emoji', () => {
    expect(primeiroNome('Eduardo Yamamoto | Gestor de Growth')).toBe('Eduardo')
    expect(primeiroNome('Marina Souza - Nutricionista')).toBe('Marina')
    expect(primeiroNome('Ju 🌸 Doces')).toBe('Ju')
    expect(primeiroNome('🌸Ana🌸')).toBe('')
    expect(primeiroNome('~Carla~')).toBe('Carla')
    expect(primeiroNome('Ana-Clara Reis')).toBe('Ana-Clara')
    expect(varsIniciais({ waId: '55449', nome: 'Eduardo Yamamoto | Growth' }).nome).toBe('Eduardo')
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
    // E o legível segue o telefone que venceu, não o do WhatsApp: a frase de
    // conferência tem que mostrar o número que o fluxo coletou.
    expect(vars.telefone_br).toBe('+55 (11) 91111-2222')
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
