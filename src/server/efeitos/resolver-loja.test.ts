import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import type { Fluxo } from '@/core/flow/schema'
import type { ProdutoDaLoja } from '@/core/loja'
import { lojaFalsa } from '@/loja/falsa'
import type { Modelo, PedidoDeIa, Resposta } from '../ia/types'

/**
 * As ferramentas de loja no laço da IA.
 *
 * O que este arquivo prova, e que nenhum teste de `core/` alcança:
 *
 *  - bloco só com ferramenta de loja funciona **sem** Conexão, e bloco com
 *    ferramenta da Verandi continua exigindo (não afrouxou a agenda);
 *  - loja fora do ar ou desligada vira "não sei" com motivo, nunca catálogo
 *    inventado;
 *  - SKU que a conversa não viu não chega à loja.
 */

const chamarHttp = vi.hoisted(() => vi.fn())
vi.mock('./http', () => ({ chamarHttp }))

const lerCredencial = vi.hoisted(() => vi.fn())
vi.mock('../repos/conexoes', () => ({ lerCredencial }))

const lojaAtivaDaConta = vi.hoisted(() => vi.fn())
vi.mock('../adaptador-da-loja', () => ({ lojaAtivaDaConta }))

vi.mock('../ia/politica', () => ({
  lerPoliticas: async () => new Map(),
  politicaDe: () => 'automatico',
}))
vi.mock('../repos/ia-chamadas', () => ({ registrarChamada: async () => {} }))
vi.mock('../alertar', () => ({ alertar: async () => {} }))

const { executarComEfeitos } = await import('./resolver')

const headset: ProdutoDaLoja = {
  produtoId: '330107',
  nome: 'Headset PCYES Comfort CM500',
  preco: 108.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/headset-comfort-cm500-pcyes-usb-40mm-cm500',
}
const suporte: ProdutoDaLoja = {
  produtoId: '195230',
  nome: 'Suporte para Headset',
  preco: 95.92,
  precoDe: 119.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/suporte-headset',
}

function fluxo(ferramentas: string[], conexaoId?: string): Fluxo {
  return {
    inicio: 'ia',
    nodes: [
      {
        id: 'ia',
        type: 'ia',
        position: { x: 0, y: 0 },
        data: { instrucao: 'Ajude a escolher.', ferramentas, ...(conexaoId ? { conexaoId } : {}) },
      },
    ],
    edges: [],
  } as Fluxo
}

/** Um modelo que segue um roteiro: cada volta devolve a próxima resposta. */
function modeloComRoteiro(roteiro: Resposta[]): Modelo & { pedidos: PedidoDeIa[] } {
  const pedidos: PedidoDeIa[] = []
  return {
    pedidos,
    async responder(pedido) {
      pedidos.push(pedido)
      return roteiro[Math.min(pedidos.length - 1, roteiro.length - 1)]!
    },
  }
}

async function rodar(f: Fluxo, modelo: Modelo) {
  return executarComEfeitos(f, sessaoNova(), { tipo: 'inicio' }, {
    modelo,
    contextoNegocio: 'Loja de periféricos.',
    historico: [{ de: 'pessoa', texto: 'tem headset?' }],
    clienteId: '00000000-0000-0000-0000-000000000001',
  } as Parameters<typeof executarComEfeitos>[3])
}

function textos(r: Awaited<ReturnType<typeof rodar>>): string[] {
  return r.acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))
}

beforeEach(() => {
  chamarHttp.mockReset()
  lerCredencial.mockReset()
  lojaAtivaDaConta.mockReset()
})

describe('ferramentas de loja no laço da IA', () => {
  it('busca na loja sem Conexão e devolve o produto ao modelo', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte] })
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos o CM500 por R$ 108,90.' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(loja.buscas).toEqual(['headset'])
    expect(lerCredencial).not.toHaveBeenCalled()
    expect(chamarHttp).not.toHaveBeenCalled()
    expect(JSON.stringify(modelo.pedidos[1])).toContain('330107')
    expect(textos(r)).toContain('Temos o CM500 por R$ 108,90.')
  })

  it('bloco com ferramenta da agenda continua exigindo credencial', async () => {
    lerCredencial.mockResolvedValue(null)
    const modelo = modeloComRoteiro([{ tipo: 'texto', texto: 'não devia chegar aqui' }])

    const r = await rodar(fluxo(['agenda_horarios', 'loja_buscar'], 'conexao-1'), modelo)

    expect(modelo.pedidos).toHaveLength(0)
    expect(textos(r)).not.toContain('não devia chegar aqui')
  })

  it('loja fora do ar não vira catálogo inventado', async () => {
    lojaAtivaDaConta.mockResolvedValue(lojaFalsa({ falhar: true }))
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos sim, R$ 50!' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(modelo.pedidos).toHaveLength(1)
    expect(textos(r)).not.toContain('Temos sim, R$ 50!')
  })

  it('loja desligada não vira catálogo inventado', async () => {
    lojaAtivaDaConta.mockResolvedValue(null)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'headset' } },
      { tipo: 'texto', texto: 'Temos sim, R$ 50!' },
    ])

    const r = await rodar(fluxo(['loja_buscar']), modelo)

    expect(textos(r)).not.toContain('Temos sim, R$ 50!')
  })

  it('SKU que a conversa não viu não chega à loja', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte], complementos: { '330107': ['195230'] } })
    const combina = vi.spyOn(loja, 'combinaCom')
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_combina_com', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'Combina com o suporte!' },
    ])

    await rodar(fluxo(['loja_buscar', 'loja_combina_com']), modelo)

    expect(combina).not.toHaveBeenCalled()
  })

  it('SKU que veio da busca passa, e o complemento chega ao modelo', async () => {
    const loja = lojaFalsa({ produtos: [headset, suporte], complementos: { '330107': ['195230'] } })
    lojaAtivaDaConta.mockResolvedValue(loja)
    const modelo = modeloComRoteiro([
      { tipo: 'usar_ferramenta', nome: 'loja_buscar', argumentos: { termo: 'cm500' } },
      { tipo: 'usar_ferramenta', nome: 'loja_combina_com', argumentos: { produtoId: '330107' } },
      { tipo: 'texto', texto: 'Leva o suporte junto?' },
    ])

    const r = await rodar(fluxo(['loja_buscar', 'loja_combina_com']), modelo)

    expect(JSON.stringify(modelo.pedidos[2])).toContain('195230')
    expect(textos(r)).toContain('Leva o suporte junto?')
  })
})
