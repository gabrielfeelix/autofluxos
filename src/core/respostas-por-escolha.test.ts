import { describe, expect, it } from 'vitest'
import { fluxoSchema } from './flow/schema'
import {
  perguntasDeEscolha,
  percentuaisQueSomamCem,
  resumirEscolhas,
  variavelDoFiltro,
} from './respostas-por-escolha'

const p = { x: 0, y: 0 }
const opcoes = (...rotulos: string[]) => rotulos.map((rotulo, i) => ({ id: `o${i}`, rotulo }))

const grafo = fluxoSchema.parse({
  inicio: 'a',
  nodes: [
    {
      id: 'a', type: 'pergunta', position: p,
      data: { texto: 'Como foi o frete?', salvarEm: 'frete', opcoes: opcoes('Bom preço e opções', 'Achei caro', 'Poucas opções') },
    },
    { id: 'b', type: 'pergunta', position: p, data: { texto: 'O que houve?', salvarEm: 'frete_comentario', opcoes: [] } },
    {
      id: 'c', type: 'pergunta', position: p,
      data: { texto: 'Qual horário?', salvarEm: 'horario', opcoes: [], opcoesDe: 'horarios' },
    },
    { id: 'd', type: 'pergunta', position: p, data: { texto: 'Pagamento?', opcoes: opcoes('Foi fácil') } },
    {
      id: 'e', type: 'pergunta', position: p,
      data: { texto: 'E o frete, de novo?', salvarEm: 'frete', opcoes: opcoes('Achei caro', 'Demorou') },
    },
  ],
  edges: [],
})

describe('perguntasDeEscolha', () => {
  it('só pergunta com botão desenhado e variável, sem a aberta nem a dinâmica', () => {
    expect(perguntasDeEscolha(grafo).map((q) => q.variavel)).toEqual(['frete'])
  })

  it('duas perguntas na mesma variável somam as opções, sem repetir', () => {
    expect(perguntasDeEscolha(grafo)[0]?.opcoes).toEqual([
      'Bom preço e opções',
      'Achei caro',
      'Poucas opções',
      'Demorou',
    ])
  })
})

describe('variavelDoFiltro', () => {
  it('aceita variável que o fluxo guarda, inclusive a aberta', () => {
    expect(variavelDoFiltro('frete', grafo)).toBe('frete')
    expect(variavelDoFiltro('frete_comentario', grafo)).toBe('frete_comentario')
  })

  it('recusa o que não é do fluxo ou não tem formato de variável', () => {
    expect(variavelDoFiltro('cpf', grafo)).toBeNull()
    expect(variavelDoFiltro("frete'),or(id.neq.0", grafo)).toBeNull()
    expect(variavelDoFiltro('frete->x', grafo)).toBeNull()
    expect(variavelDoFiltro('', grafo)).toBeNull()
    expect(variavelDoFiltro('frete', null)).toBeNull()
  })
})

describe('resumirEscolhas', () => {
  const linhas = [
    { frete: 'Bom preço e opções' },
    { frete: 'Bom preço e opções' },
    { frete: 'Achei caro', frete_comentario: 'R$ 40 para o interior' },
    { frete: 'achei caro' },
    { frete: '' },
    { nome: 'sem resposta' },
    null,
  ]

  it('conta cada opção, com as zeradas presentes e o resto em Outras', () => {
    const frete = resumirEscolhas(perguntasDeEscolha(grafo), linhas)[0]!
    expect(frete.respondidas).toBe(4)
    expect(frete.contagens).toEqual([
      { rotulo: 'Bom preço e opções', total: 2, percentual: 50 },
      { rotulo: 'Achei caro', total: 1, percentual: 25 },
      { rotulo: 'Poucas opções', total: 0, percentual: 0 },
      { rotulo: 'Demorou', total: 0, percentual: 0 },
    ])
    expect(frete.outras).toEqual({ rotulo: 'Outras', total: 1, percentual: 25 })
  })

  it('sem resposta nenhuma, tudo zero e sem dividir por zero', () => {
    const frete = resumirEscolhas(perguntasDeEscolha(grafo), [])[0]!
    expect(frete.respondidas).toBe(0)
    expect(frete.contagens.every((c) => c.percentual === 0)).toBe(true)
  })
})

describe('percentuaisQueSomamCem', () => {
  it('três terços fecham 100, não 99', () => {
    expect(percentuaisQueSomamCem([1, 1, 1], 3)).toEqual([34, 33, 33])
  })

  it('opção zerada continua zero mesmo quando falta ponto', () => {
    const r = percentuaisQueSomamCem([2, 1, 0], 3)
    expect(r).toEqual([67, 33, 0])
  })
})
