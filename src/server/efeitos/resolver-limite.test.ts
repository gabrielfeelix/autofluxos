import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

/**
 * O limite de respostas de IA por contato (`clients.ia_limite_contato_dia`).
 *
 * O que se prova: no limite o modelo não é chamado e a conversa vai para uma
 * pessoa; abaixo dele, cada resposta é contada; sem limite, nada é gravado; e o
 * simulador não conta nem é barrado.
 */

const cotaDeIaDoContato = vi.hoisted(() => vi.fn())
const registrarRespostaDaIa = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../repos/ia-chamadas', () => ({
  cotaDeIaDoContato,
  registrarRespostaDaIa,
  registrarChamada: async () => {},
}))
vi.mock('./http', () => ({ chamarHttp: vi.fn() }))
vi.mock('../repos/conexoes', () => ({ lerCredencial: vi.fn() }))
vi.mock('../alertar', () => ({ alertar: async () => {} }))

const { executarComEfeitos, AVISO_DE_LIMITE_DE_IA } = await import('./resolver')

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

const fluxo: Fluxo = {
  inicio: 'pizzaria',
  nodes: [
    {
      id: 'pizzaria',
      type: 'ia',
      position: { x: 0, y: 0 },
      data: { instrucao: 'Atenda a pizzaria.', ferramentas: [], conversar: { maxTurnos: 10 } },
    },
  ],
  edges: [],
}

const daConta = { clienteId: 'c1', contatoId: 'p1', origem: 'whatsapp' as const, contextoNegocio: 'Pizzaria.' }

beforeEach(() => {
  cotaDeIaDoContato.mockReset()
  registrarRespostaDaIa.mockClear()
})

describe('limite de IA por contato', () => {
  it('no limite, não chama o modelo, avisa e passa para uma pessoa', async () => {
    cotaDeIaDoContato.mockResolvedValue({ limite: 20, usadas: 20 })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'não devia sair' }))

    const r = await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, { ...daConta, modelo })

    expect(modelo.pedidos).toHaveLength(0)
    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos).toEqual([AVISO_DE_LIMITE_DE_IA])
    expect(r.acoes.some((a) => a.tipo === 'chamar_ia')).toBe(false)
    expect(r.acoes.at(-1)).toMatchObject({ tipo: 'transferir_humano' })
    expect(r.sessao.status).toBe('humano')
    expect(registrarRespostaDaIa).not.toHaveBeenCalled()
  })

  it('fora do expediente, diz também quando o time volta', async () => {
    cotaDeIaDoContato.mockResolvedValue({ limite: 1, usadas: 1 })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'x' }))

    const r = await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, {
      ...daConta,
      modelo,
      atendimento: { atendimentoAberto: false, proximaAbertura: 'amanhã a partir das 18:00' },
    })

    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
    expect(textos[0]).toBe(AVISO_DE_LIMITE_DE_IA)
    expect(textos[1]).toContain('amanhã a partir das 18:00')
  })

  it('abaixo do limite, responde e conta a resposta', async () => {
    cotaDeIaDoContato.mockResolvedValue({ limite: 20, usadas: 19 })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'Temos calabresa.' }))

    const r = await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, { ...daConta, modelo })

    expect(modelo.pedidos).toHaveLength(1)
    expect(registrarRespostaDaIa).toHaveBeenCalledWith('c1', 'p1')
    expect(r.sessao.status).toBe('ativa')
  })

  it('sem limite na conta, responde e não grava nada a mais', async () => {
    cotaDeIaDoContato.mockResolvedValue({ limite: null, usadas: 0 })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'Oi!' }))

    await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, { ...daConta, modelo })

    expect(modelo.pedidos).toHaveLength(1)
    expect(registrarRespostaDaIa).not.toHaveBeenCalled()
  })

  it('o simulador não conta nem é barrado', async () => {
    cotaDeIaDoContato.mockResolvedValue({ limite: 1, usadas: 99 })
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'Oi!' }))

    await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, {
      ...daConta,
      origem: 'simulador',
      modelo,
    })

    expect(cotaDeIaDoContato).not.toHaveBeenCalled()
    expect(modelo.pedidos).toHaveLength(1)
  })

  it('sem contato conhecido, não há o que limitar', async () => {
    const modelo = modeloQue(() => ({ tipo: 'texto', texto: 'Oi!' }))

    await executarComEfeitos(fluxo, sessaoNova(), { tipo: 'inicio' }, {
      modelo,
      contextoNegocio: 'Pizzaria.',
      clienteId: 'c1',
    })

    expect(cotaDeIaDoContato).not.toHaveBeenCalled()
    expect(modelo.pedidos).toHaveLength(1)
  })
})
