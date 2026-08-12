import { describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import { executarComEfeitos } from './resolver'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

/**
 * Sem rede e sem chave: o modelo é de mentira de propósito.
 *
 * O que precisa ser provado aqui não é se o Gemini responde bem — isso é o
 * `gemini.test.ts`. É o que o sistema faz com a resposta: quando a IA sabe,
 * quando não sabe, e quando não existe IA nenhuma.
 */

function modeloQue(responde: (p: PedidoDeIa) => Resposta): Modelo & { pedidos: PedidoDeIa[] } {
  const pedidos: PedidoDeIa[] = []
  return {
    pedidos,
    async responder(pedido) {
      pedidos.push(pedido)
      return responde(pedido)
    },
  }
}

/** Pessoa escreve → IA responde → despedida. Com saída para humano, como manda o validador. */
const fluxoComIa: Fluxo = {
  inicio: 'duvida',
  nodes: [
    {
      id: 'duvida',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: { instrucao: 'Responda a dúvida sobre o serviço.' },
    },
    {
      id: 'fim',
      type: 'handoff',
      position: { x: 0, y: 120 },
      data: { motivo: 'fim da conversa', mensagem: 'Já te passo para alguém.' },
    },
  ],
  edges: [{ id: 'a1', source: 'duvida', target: 'fim' }],
}

const contextoNegocio = 'Pintura em Maringá. Orçamento gratuito.'

describe('quando existe IA', () => {
  it('chama o modelo, manda a resposta e segue o fluxo', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'O orçamento é gratuito!' }))

    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
      historico: [{ de: 'pessoa', texto: 'o orçamento é pago?' }],
    })

    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos).toContain('O orçamento é gratuito!')

    // O pedido de IA já foi atendido: deixar ele na lista faria quem aplica
    // mandar a conversa para um humano em cima de uma resposta que deu certo.
    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(false)

    // E o fluxo continuou: o bloco seguinte é o handoff do fim.
    expect(r.sessao.status).toBe('humano')
  })

  it('leva o contexto do negócio e a pergunta da pessoa até o modelo', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'ok' }))

    await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
      historico: [
        { de: 'pessoa', texto: 'primeira' },
        { de: 'bot', texto: 'oi' },
        { de: 'pessoa', texto: 'o orçamento é pago?' },
      ],
    })

    expect(modelo.pedidos).toHaveLength(1)
    expect(modelo.pedidos[0]?.contextoNegocio).toBe(contextoNegocio)
    expect(modelo.pedidos[0]?.instrucao).toBe('Responda a dúvida sobre o serviço.')
    // A pergunta é a última coisa que a PESSOA disse, não a última linha.
    expect(modelo.pedidos[0]?.pergunta).toBe('o orçamento é pago?')
  })

  /** A saída de emergência: entre calar e inventar, uma pessoa assume. */
  it('quando a IA não sabe, avisa e passa para uma pessoa', async () => {
    const modelo = modeloQue(() => ({ tipo: 'nao_sei', motivo: 'fora do contexto' }))

    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio,
    })

    const transferencia = r.acoes.find((a) => a.tipo === 'transferir_humano')
    expect(transferencia).toBeDefined()
    expect(transferencia?.tipo === 'transferir_humano' && transferencia.motivo).toContain(
      'fora do contexto',
    )
    expect(r.sessao.status).toBe('humano')

    // A pessoa não pode ficar no vácuo esperando: sai um aviso antes.
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto')).toBe(true)
  })
})

describe('quando não existe IA', () => {
  /**
   * Sem plano contratado ou sem chave, `chamar_ia` fica na lista e quem chamou
   * decide — hoje, mandar para uma pessoa. O que não pode é fingir que
   * respondeu.
   */
  it('devolve o pedido de IA intacto, sem inventar resposta', async () => {
    const r = await executarComEfeitos(fluxoComIa, sessaoNova(), { tipo: 'inicio' }, {
      modelo: null,
      contextoNegocio,
    })

    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(true)
    expect(r.sessao.status).toBe('aguardando_ia')
  })
})

describe('fluxo sem IA nenhuma', () => {
  it('não chama o modelo à toa', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'não deveria ser chamado' }))
    const simples: Fluxo = {
      inicio: 'oi',
      nodes: [
        { id: 'oi', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'Olá!' } },
        {
          id: 'fim',
          type: 'handoff',
          position: { x: 0, y: 100 },
          data: { motivo: 'fim', mensagem: 'Já te passo para alguém.' },
        },
      ],
      edges: [{ id: 'a1', source: 'oi', target: 'fim' }],
    }

    await executarComEfeitos(simples, sessaoNova(), { tipo: 'inicio' }, { modelo, contextoNegocio })
    expect(modelo.pedidos).toHaveLength(0)
  })
})
