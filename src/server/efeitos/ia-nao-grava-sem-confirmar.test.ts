import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

const chamarHttp = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({ chamarHttp }))
vi.mock('../repos/conexoes', () => ({
  lerCredencial: vi.fn(async () => ({ tipo: 'bearer', campo: null, valor: 'vr_teste' })),
}))
vi.mock('../recursos-do-plano', () => ({ recursoLiberado: vi.fn(async () => true) }))
vi.mock('../repos/produtos', () => ({ listarProdutos: vi.fn(async () => []) }))
// Conta que nunca mexeu na política: vale o padrão do código, que é confirmar.
vi.mock('../ia/politica', async (original) => ({
  ...(await original<typeof import('../ia/politica')>()),
  lerPoliticas: vi.fn(async () => new Map()),
}))

const { executarComEfeitos } = await import('./resolver')

/**
 * A IA não grava nada sem a pessoa confirmar (revisão de 19/out/2026, Parte 2).
 *
 * `politica.test.ts` prova que o padrão de escrita é `confirmar`. Este prova o
 * que importa: com o padrão, o modelo pedindo para marcar a aula **não faz a
 * chamada que grava**. Sai uma pergunta, e a única chamada de rede é a leitura
 * dos horários. Pedir no prompt que o modelo confirme é pedir; isto é garantir.
 */
describe('a IA e a ferramenta que grava', () => {
  beforeEach(() => {
    chamarHttp.mockReset()
    chamarHttp.mockResolvedValue({
      ok: true,
      valores: {},
      json: {
        livres: [{ sessaoId: 'S1', data: '2026-10-21', hora: '08:00', servico: 'Pilates', profissional: 'Ana' }],
        cheios: [],
      },
    })
  })

  const fluxo: Fluxo = {
    inicio: 'agenda',
    nodes: [
      {
        id: 'agenda',
        type: 'ia',
        position: { x: 0, y: 0 },
        data: {
          instrucao: 'Marque a aula que a pessoa pedir.',
          ferramentas: ['agenda_horarios', 'agenda_marcar'],
          conexaoId: 'conexao-verandi',
        },
      },
      {
        id: 'fim',
        type: 'handoff',
        position: { x: 0, y: 120 },
        data: { motivo: 'fim', mensagem: 'Já te passo para alguém.' },
      },
    ],
    edges: [{ id: 'a1', source: 'agenda', target: 'fim' }],
  } as Fluxo

  it('pede confirmação e não faz a chamada que grava', async () => {
    const pedidos: PedidoDeIa[] = []
    let volta = 0
    const modelo: Modelo = {
      async responder(pedido): Promise<Resposta> {
        pedidos.push(pedido)
        volta++
        if (volta === 1) {
          return { tipo: 'usar_ferramenta', nome: 'agenda_horarios', argumentos: { de: '2026-10-21', ate: '2026-10-21' } }
        }
        return { tipo: 'usar_ferramenta', nome: 'agenda_marcar', argumentos: { sessao_id: 'S1' } }
      },
    }

    const sessao = { ...sessaoNova(), vars: { pessoa_id: 'P1' } }
    const r = await executarComEfeitos(fluxo, sessao, { tipo: 'inicio' }, {
      modelo,
      contextoNegocio: 'Estúdio de pilates.',
      clienteId: 'cliente-teste',
      historico: [{ de: 'pessoa', texto: 'quero a aula de quarta às 8' }],
    })

    // a IA chegou a pedir para gravar: o teste não passa por ela ter desistido
    expect(volta).toBe(2)

    const metodos = chamarHttp.mock.calls.map(([pedido]) => (pedido as { metodo: string }).metodo)
    expect(metodos).toEqual(['GET'])

    // o que sai para a pessoa é a pergunta, com o que vai ser feito
    const textos = r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : a.tipo === 'enviar_opcoes' ? [a.texto] : []))
    expect(textos.join(' ')).toMatch(/marcar você em/)
  })
})
