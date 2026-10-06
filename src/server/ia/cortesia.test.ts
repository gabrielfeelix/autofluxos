import { describe, expect, it } from 'vitest'
import { comCortesia, temCortesia } from './cortesia'
import { RECUSA_FORA_DO_ASSUNTO } from './prompt'
import type { Modelo, PedidoDeIa } from './types'

const pedido = (pergunta: string): PedidoDeIa => ({ contextoNegocio: 'Loja', instrucao: 'Atenda.', pergunta })
const recusa = { tipo: 'texto', texto: RECUSA_FORA_DO_ASSUNTO } as const

function falso(respostas: Awaited<ReturnType<Modelo['responder']>>[]) {
  const pedidos: PedidoDeIa[] = []
  const modelo: Modelo = {
    async responder(p) {
      pedidos.push(p)
      return respostas[pedidos.length - 1] ?? recusa
    },
  }
  return { modelo, pedidos }
}

describe('agradecimento nunca recebe a recusa de fora do assunto', () => {
  it('"Agradeço" recusado: pergunta de novo, avisando, e usa a resposta do modelo', async () => {
    // PCYES, 06/out/2026: encaminhado ao comercial, agradeceu e levou a recusa.
    const { modelo, pedidos } = falso([recusa, { tipo: 'texto', texto: 'Por nada, Paulo! Qualquer coisa, estou por aqui.' }])
    const r = await comCortesia(modelo).responder(pedido('Agradeço'))
    expect(r).toEqual({ tipo: 'texto', texto: 'Por nada, Paulo! Qualquer coisa, estou por aqui.' })
    expect(pedidos).toHaveLength(2)
    expect(pedidos[1]!.instrucao).toContain('nunca é fora do assunto')
  })

  it('agradeceu e pediu mais: o modelo, avisado, atende o pedido', async () => {
    const { modelo } = falso([recusa, { tipo: 'texto', texto: 'Claro! Tenho o suporte em branco também.' }])
    const r = await comCortesia(modelo).responder(pedido('valeu! e tem em branco?'))
    expect(r).toEqual({ tipo: 'texto', texto: 'Claro! Tenho o suporte em branco também.' })
  })

  it('insistiu na recusa: sai a frase curta que não fecha a porta', async () => {
    const { modelo } = falso([recusa, recusa])
    const r = await comCortesia(modelo).responder(pedido('obrigado'))
    expect(r).toEqual({ tipo: 'texto', texto: 'Por nada! Posso ajudar em mais alguma coisa?' })
  })

  it('recusa de assunto que não é cortesia passa como veio, sem segunda chamada', async () => {
    const { modelo, pedidos } = falso([recusa])
    expect(await comCortesia(modelo).responder(pedido('quem é pablo vittar?'))).toEqual(recusa)
    expect(pedidos).toHaveLength(1)
  })

  it('reconhece as formas comuns', () => {
    for (const m of ['Agradeço', 'obrigada!!', 'muito obrigado pela ajuda', 'vlw', '👍', '🙏🏻', 'ok, blz', 'show, valeu']) {
      expect(temCortesia(m)).toBe(true)
    }
    expect(temCortesia('quem é pablo vittar?')).toBe(false)
  })
})
