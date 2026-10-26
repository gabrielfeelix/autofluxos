import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { validar } from '../flow/validar'
import { executar } from './executar'
import { sessaoNova, type Acao } from './types'

const p = { x: 0, y: 0 }

function fluxoDePontos(data: Record<string, unknown>): Fluxo {
  return fluxoSchema.parse({
    inicio: 'pontos',
    nodes: [
      { id: 'pontos', type: 'pontos', position: p, data },
      { id: 'ok', type: 'mensagem', position: p, data: { texto: 'Seus pontos já estão na conta.' } },
      { id: 'atraso', type: 'mensagem', position: p, data: { texto: 'Seus pontos entram em até 2 dias.' } },
    ],
    edges: [
      { id: 'e1', source: 'pontos', sourceHandle: 'creditou', target: 'ok' },
      { id: 'e2', source: 'pontos', sourceHandle: 'nao_creditou', target: 'atraso' },
    ],
  })
}

const textos = (acoes: Acao[]) => acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)
const vars = { pedido: '000123', customer_id: '182' }

describe('o bloco Dar pontos', () => {
  it('pede os pontos com o pedido e o cliente da conversa, e para esperando a loja', () => {
    const r = executar(fluxoDePontos({ pontos: 50 }), { ...sessaoNova(), vars }, { tipo: 'inicio' })
    expect(r.acoes).toEqual([{ tipo: 'dar_pontos', pontos: 50, pedido: '000123', clienteDaLoja: '182' }])
    expect(r.sessao).toMatchObject({ noAtual: 'pontos', status: 'aguardando_http' })
  })

  it('lançou e não lançou seguem cada um pela sua saída', () => {
    const fluxo = fluxoDePontos({ pontos: 50 })
    const parado = executar(fluxo, { ...sessaoNova(), vars }, { tipo: 'inicio' }).sessao
    expect(textos(executar(fluxo, parado, { tipo: 'pontos', creditou: true }).acoes)).toEqual([
      'Seus pontos já estão na conta.',
    ])
    expect(textos(executar(fluxo, parado, { tipo: 'pontos', creditou: false }).acoes)).toEqual([
      'Seus pontos entram em até 2 dias.',
    ])
  })

  it('mensagem da pessoa enquanto a loja responde não move nada', () => {
    const fluxo = fluxoDePontos({ pontos: 50 })
    const parado = executar(fluxo, { ...sessaoNova(), vars }, { tipo: 'inicio' }).sessao
    const r = executar(fluxo, parado, { tipo: 'texto', texto: 'oi' })
    expect(r.acoes).toEqual([])
    expect(r.sessao.noAtual).toBe('pontos')
  })

  it('não publica sem pontos', () => {
    const { erros } = validar(fluxoDePontos({ pontos: 0 }))
    expect(erros.map((e) => e.codigo)).toContain('PONTOS_SEM_VALOR')
  })
})
