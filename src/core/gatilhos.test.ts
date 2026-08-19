import { describe, expect, it } from 'vitest'
import { casarGatilho, type Gatilho } from './gatilhos'

/**
 * O gatilho decide para onde a conversa vai antes de o fluxo padrão ter voz.
 * Errar para mais — casar quando não devia — sequestra o atendimento de quem
 * escreveu outra coisa, e sequestra calado: a pessoa cai num fluxo que não
 * pediu e ninguém no painel vê nada de anormal.
 */

const gatilho = (partes: Partial<Gatilho> & { frase: string }): Gatilho => ({
  id: partes.frase,
  operador: 'contem',
  fluxoId: `fluxo-${partes.frase}`,
  ativo: true,
  execucoes: 0,
  ...partes,
})

describe('casar a frase', () => {
  it('`igual` exige a frase inteira', () => {
    const gatilhos = [gatilho({ frase: 'cancelar', operador: 'igual' })]

    expect(casarGatilho(gatilhos, 'cancelar')?.fluxoId).toBe('fluxo-cancelar')
    expect(casarGatilho(gatilhos, 'quero cancelar')).toBeNull()
  })

  it('`contem` acha a palavra no meio da frase', () => {
    const gatilhos = [gatilho({ frase: 'cancelar' })]

    expect(casarGatilho(gatilhos, 'quero cancelar meu plano')?.fluxoId).toBe('fluxo-cancelar')
  })

  it('ignora acento, caixa e espaço em volta, dos dois lados', () => {
    const gatilhos = [gatilho({ frase: '  Orçamento ', operador: 'igual' })]

    expect(casarGatilho(gatilhos, 'ORCAMENTO')).not.toBeNull()
    expect(casarGatilho(gatilhos, ' orçamento ')).not.toBeNull()
  })

  it('`contem` é palavra, não pedaço de palavra', () => {
    // O engano que este teste existe para impedir: `sim` disparando em
    // "assim", "simples" e "simpatia". Quem cadastrou `sim` nunca ligaria a
    // causa ao efeito — a tela dele diz `sim` e a conversa foi para outro lugar.
    const gatilhos = [gatilho({ frase: 'sim' })]

    expect(casarGatilho(gatilhos, 'sim')).not.toBeNull()
    expect(casarGatilho(gatilhos, 'sim, pode ser')).not.toBeNull()
    expect(casarGatilho(gatilhos, 'assim mesmo')).toBeNull()
    expect(casarGatilho(gatilhos, 'simples assim')).toBeNull()
  })

  it('pontuação colada conta como borda', () => {
    const gatilhos = [gatilho({ frase: 'cancelar' })]

    expect(casarGatilho(gatilhos, 'quero cancelar!')).not.toBeNull()
    expect(casarGatilho(gatilhos, '(cancelar)')).not.toBeNull()
  })

  it('frase com caractere de expressão regular é texto, não sintaxe', () => {
    // Sem varredura manual, `.` viraria "qualquer caractere" e `(` estouraria
    // no meio do webhook. O caso ruim não é não casar — é a exceção.
    const gatilhos = [gatilho({ frase: 'promo (2x1)' })]

    expect(casarGatilho(gatilhos, 'quero a promo (2x1) de hoje')).not.toBeNull()
    expect(casarGatilho(gatilhos, 'quero a promo 2x1 de hoje')).toBeNull()
  })

  it('gatilho desligado não decide nada', () => {
    const gatilhos = [gatilho({ frase: 'cancelar', ativo: false })]

    expect(casarGatilho(gatilhos, 'quero cancelar')).toBeNull()
  })

  it('mensagem vazia não casa nem com gatilho vazio', () => {
    expect(casarGatilho([gatilho({ frase: '   ' })], '')).toBeNull()
    expect(casarGatilho([gatilho({ frase: '   ' })], 'oi')).toBeNull()
  })
})

describe('quando mais de um casa', () => {
  it('`igual` ganha de `contem`', () => {
    const gatilhos = [
      gatilho({ frase: 'cancelar', operador: 'contem', fluxoId: 'largo' }),
      gatilho({ frase: 'cancelar', operador: 'igual', fluxoId: 'exato' }),
    ]

    expect(casarGatilho(gatilhos, 'cancelar')?.fluxoId).toBe('exato')
  })

  it('entre dois `contem`, a frase mais específica ganha', () => {
    const gatilhos = [
      gatilho({ frase: 'cancelar', fluxoId: 'generico' }),
      gatilho({ frase: 'cancelar assinatura', fluxoId: 'especifico' }),
    ]

    expect(casarGatilho(gatilhos, 'quero cancelar assinatura agora')?.fluxoId).toBe('especifico')
    // E a ordem em que o banco devolveu não pode mudar a resposta.
    expect(casarGatilho([...gatilhos].reverse(), 'quero cancelar assinatura agora')?.fluxoId).toBe(
      'especifico',
    )
  })
})
