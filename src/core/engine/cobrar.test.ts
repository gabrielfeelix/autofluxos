import { describe, expect, it } from 'vitest'
import { centavosDoTotal, VARIAVEIS_DA_COBRANCA } from '../cobranca'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { validar } from '../flow/validar'
import { executar, MENSAGEM_ESPERANDO_PAGAMENTO, MENSAGEM_PAGAMENTO_CONFIRMADO } from './executar'
import { sessaoNova, type Acao, type Sessao } from './types'

const p = { x: 0, y: 0 }

function fluxoDeCobranca(data: Record<string, unknown>, ligado = true): Fluxo {
  return fluxoSchema.parse({
    inicio: 'cobrar',
    nodes: [
      { id: 'cobrar', type: 'cobrar', position: p, data: { descricao: 'Aula de {{modalidade}}', ...data } },
      { id: 'pago', type: 'mensagem', position: p, data: { texto: 'Recebido! Até a aula.' } },
      { id: 'lembrar', type: 'handoff', position: p, data: { motivo: 'não pagou' } },
    ],
    edges: ligado
      ? [
          { id: 'e1', source: 'cobrar', sourceHandle: 'pagou', target: 'pago' },
          { id: 'e2', source: 'cobrar', sourceHandle: 'venceu', target: 'lembrar' },
        ]
      : [],
  })
}

const textos = (acoes: Acao[]) => acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)

function parado(fluxo: Fluxo, vars: Record<string, string> = {}): Sessao {
  return executar(fluxo, { ...sessaoNova(), vars }, { tipo: 'inicio' }).sessao
}

describe('o bloco Cobrar', () => {
  it('cria a cobrança com o valor do bloco e para esperando', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 4990, horasParaVencer: 6 })
    const r = executar(fluxo, { ...sessaoNova(), vars: { modalidade: 'pilates' } }, { tipo: 'inicio' })
    expect(r.acoes).toEqual([
      { tipo: 'criar_cobranca', noId: 'cobrar', valorCentavos: 4990, descricao: 'Aula de pilates', horasParaVencer: 6 },
    ])
    expect(r.sessao).toMatchObject({ noAtual: 'cobrar', status: 'ativa' })
  })

  it('cobra o total que o catálogo somou, nunca outro número', () => {
    const fluxo = fluxoDeCobranca({ valorDe: 'pedido' })
    const r = executar(fluxo, { ...sessaoNova(), vars: { [VARIAVEIS_DA_COBRANCA.total]: '109,80' } }, { tipo: 'inicio' })
    expect(r.acoes[0]).toMatchObject({ tipo: 'criar_cobranca', valorCentavos: 10980 })
  })

  it('sem total do pedido, vai para uma pessoa em vez de cobrar', () => {
    const r = executar(fluxoDeCobranca({ valorDe: 'pedido' }), sessaoNova(), { tipo: 'inicio' })
    expect(r.acoes.some((a) => a.tipo === 'criar_cobranca')).toBe(false)
    expect(r.acoes.at(-1)).toMatchObject({ tipo: 'transferir_humano' })
    expect(r.sessao.status).toBe('humano')
  })

  it('pagou segue pela saída pagou', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 })
    const r = executar(fluxo, parado(fluxo), { tipo: 'cobranca', desfecho: 'pagou' })
    expect(textos(r.acoes)).toEqual(['Recebido! Até a aula.'])
  })

  it('venceu segue pela saída venceu', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 })
    const r = executar(fluxo, parado(fluxo), { tipo: 'cobranca', desfecho: 'venceu' })
    expect(r.acoes.at(-1)).toMatchObject({ tipo: 'transferir_humano', motivo: 'não pagou' })
  })

  it('sem saídas desenhadas: pagou agradece e encerra, venceu vai para a fila calado', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 }, false)
    const pagou = executar(fluxo, parado(fluxo), { tipo: 'cobranca', desfecho: 'pagou' })
    expect(textos(pagou.acoes)).toEqual([MENSAGEM_PAGAMENTO_CONFIRMADO])
    expect(pagou.sessao.status).toBe('encerrada')

    const venceu = executar(fluxo, parado(fluxo), { tipo: 'cobranca', desfecho: 'venceu' })
    expect(textos(venceu.acoes)).toEqual([])
    expect(venceu.acoes).toEqual([{ tipo: 'transferir_humano', motivo: 'a cobrança venceu sem pagamento' }])
  })

  it('quem escreve esperando ouve uma vez, e na terceira vai para uma pessoa', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 })
    const primeira = executar(fluxo, parado(fluxo), { tipo: 'texto', texto: 'já paguei' })
    expect(textos(primeira.acoes)).toEqual([MENSAGEM_ESPERANDO_PAGAMENTO])
    const segunda = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: 'ok' })
    expect(segunda.acoes).toEqual([])
    expect(segunda.sessao.noAtual).toBe('cobrar')
    const terceira = executar(fluxo, segunda.sessao, { tipo: 'texto', texto: 'e aí?' })
    expect(terceira.sessao.status).toBe('humano')
  })

  it('o comprovante em foto não tira a conversa da espera', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 })
    const r = executar(fluxo, parado(fluxo), { tipo: 'midia', formato: 'image', midiaId: 'x' })
    expect(r.sessao).toMatchObject({ noAtual: 'cobrar', status: 'ativa' })
  })

  it('timeout de pergunta perdido não mexe na cobrança', () => {
    const fluxo = fluxoDeCobranca({ valorCentavos: 100 })
    const r = executar(fluxo, parado(fluxo), { tipo: 'timeout' })
    expect(r.acoes).toEqual([])
    expect(r.sessao.noAtual).toBe('cobrar')
  })
})

describe('centavosDoTotal', () => {
  it('lê só o formato que montarCobranca escreve', () => {
    expect(centavosDoTotal('109,80')).toBe(10980)
    expect(centavosDoTotal('0,00')).toBeNull()
    expect(centavosDoTotal('109.80')).toBeNull()
    expect(centavosDoTotal('R$ 10,00')).toBeNull()
    expect(centavosDoTotal(undefined)).toBeNull()
  })
})

describe('validar o bloco Cobrar', () => {
  const codigos = (fluxo: Fluxo, cobrancaHabilitada?: boolean) => {
    const r = validar(fluxo, { cobrancaHabilitada })
    return [...r.erros, ...r.avisos].map((e) => e.codigo)
  }

  it('sem conta de recebimento, não publica', () => {
    expect(codigos(fluxoDeCobranca({ valorCentavos: 100 }), false)).toContain('COBRAR_SEM_CONEXAO')
    expect(codigos(fluxoDeCobranca({ valorCentavos: 100 }), true)).not.toContain('COBRAR_SEM_CONEXAO')
  })

  it('cobra valor e descrição', () => {
    const c = codigos(fluxoDeCobranca({ descricao: '', valorCentavos: 0 }))
    expect(c).toContain('COBRAR_SEM_VALOR')
    expect(c).toContain('COBRAR_SEM_DESCRICAO')
  })

  it('total do pedido exige uma IA que monte pedido', () => {
    expect(codigos(fluxoDeCobranca({ valorDe: 'pedido' }))).toContain('COBRAR_SEM_PEDIDO')
  })

  it('avisa quando venceu não tem caminho', () => {
    expect(codigos(fluxoDeCobranca({ valorCentavos: 100 }, false))).toContain('COBRAR_SEM_VENCEU')
  })

  it('nenhum outro bloco escreve no total do pedido', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'q',
      nodes: [
        { id: 'q', type: 'pergunta', position: p, data: { texto: 'Quanto quer pagar?', opcoes: [], salvarEm: 'cobranca_total' } },
        { id: 'h', type: 'handoff', position: p, data: { motivo: 'x' } },
      ],
      edges: [{ id: 'e', source: 'q', target: 'h' }],
    })
    expect(codigos(fluxo)).toContain('VARIAVEL_DA_COBRANCA')
  })

  it('guardar vazio é limpar, e pode; guardar um valor não pode', () => {
    const comValor = (valor: string) =>
      fluxoSchema.parse({
        inicio: 'm',
        nodes: [
          { id: 'm', type: 'mensagem', position: p, data: { partes: [{ tipo: 'salvar', campo: 'cobranca_total', valor }, { tipo: 'texto', texto: 'Oi' }] } },
          { id: 'h', type: 'handoff', position: p, data: { motivo: 'x' } },
        ],
        edges: [{ id: 'e', source: 'm', target: 'h' }],
      })
    expect(codigos(comValor(''))).not.toContain('VARIAVEL_DA_COBRANCA')
    expect(codigos(comValor('10,00'))).toContain('VARIAVEL_DA_COBRANCA')
  })
})
