import { describe, expect, it } from 'vitest'
import {
  interpretarResposta,
  LIMITE_RESPOSTA,
  MARCA_NAO_SEI,
  montarPrompt,
  TURNOS_DE_HISTORICO,
} from './prompt'

/**
 * Sem rede e sem chave: é a parte do módulo de IA que é regra, não integração.
 * Roda em qualquer máquina, inclusive num clone sem `.env`.
 */

const pedido = {
  contextoNegocio: 'Pintura residencial em Maringá. Orçamento gratuito. Não fazemos telhado.',
  instrucao: 'Responda a dúvida do cliente sobre o serviço.',
  pergunta: 'vocês pintam apartamento?',
}

describe('o prompt fecha o escopo', () => {
  it('leva o contexto do negócio e a instrução do bloco', () => {
    const { sistema } = montarPrompt(pedido)
    expect(sistema).toContain('Pintura residencial em Maringá')
    expect(sistema).toContain('Responda a dúvida do cliente sobre o serviço.')
  })

  /**
   * A política da Meta proíbe IA de propósito geral na Business API. Se estas
   * instruções sumirem, o número do cliente é que paga — por isso viram teste.
   */
  it('proíbe responder fora do contexto e manda sinalizar quando não souber', () => {
    const { sistema } = montarPrompt(pedido)
    expect(sistema).toContain('SOMENTE')
    expect(sistema).toContain(MARCA_NAO_SEI)
    expect(sistema).toMatch(/propósito geral/i)
  })

  it('avisa quando não há contexto nenhum, em vez de mandar um vazio silencioso', () => {
    const { sistema } = montarPrompt({ ...pedido, contextoNegocio: '   ' })
    expect(sistema).toContain('(nada foi informado sobre a empresa)')
  })

  it('manda a pergunta e a conversa recente, do mais antigo para o mais novo', () => {
    const { usuario } = montarPrompt({
      ...pedido,
      historico: [
        { de: 'pessoa', texto: 'oi' },
        { de: 'bot', texto: 'Olá! Como ajudo?' },
      ],
    })
    expect(usuario.indexOf('oi')).toBeLessThan(usuario.indexOf('Olá! Como ajudo?'))
    expect(usuario).toContain('vocês pintam apartamento?')
  })

  it('corta histórico antigo — conversa de triagem não precisa de memória longa', () => {
    const historico = Array.from({ length: 20 }, (_, i) => ({
      de: 'pessoa' as const,
      texto: `mensagem ${i}`,
    }))
    const { usuario } = montarPrompt({ ...pedido, historico })

    expect(usuario).not.toContain('mensagem 0')
    expect(usuario).toContain(`mensagem ${20 - 1}`)
    expect(usuario.match(/mensagem \d+/g)).toHaveLength(TURNOS_DE_HISTORICO)
  })
})

describe('a resposta vira decisão', () => {
  it('texto normal passa', () => {
    expect(interpretarResposta('Pintamos sim, apartamento e casa.')).toEqual({
      tipo: 'texto',
      texto: 'Pintamos sim, apartamento e casa.',
    })
  })

  it('a marca combinada vira "não sei", sozinha ou embrulhada em frase', () => {
    for (const bruto of [MARCA_NAO_SEI, `"${MARCA_NAO_SEI}"`, `Acho que ${MARCA_NAO_SEI}.`, 'nao_sei']) {
      expect(interpretarResposta(bruto).tipo).toBe('nao_sei')
    }
  })

  /** Entre calar e inventar, uma pessoa assume. Vazio nunca vira mensagem. */
  it('vazio, só espaço e nulo viram "não sei" em vez de mensagem em branco', () => {
    for (const bruto of ['', '   ', null, undefined]) {
      expect(interpretarResposta(bruto).tipo).toBe('nao_sei')
    }
  })

  it('encurta resposta longa demais para o WhatsApp, sem partir palavra', () => {
    const longa = 'palavra '.repeat(400).trim()
    const r = interpretarResposta(longa)

    if (r.tipo !== 'texto') throw new Error('deveria ser texto')
    expect(r.texto.length).toBeLessThanOrEqual(LIMITE_RESPOSTA + 1)
    expect(r.texto.endsWith('…')).toBe(true)
    expect(r.texto).not.toMatch(/palav…$/)
  })
})
