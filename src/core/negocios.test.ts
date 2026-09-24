import { describe, expect, it } from 'vitest'
import {
  categoriaDoEvento,
  comoDias,
  degrauDaEtapa,
  diasDesde,
  eventoDoNegocio,
  filtrarHistorico,
  filtrarNegocios,
  fraseDaAtividade,
  fraseDoNegocio,
  tituloDoNegocio,
} from './negocios'

describe('tituloDoNegocio', () => {
  it('usa o título quando há', () => {
    expect(tituloDoNegocio({ titulo: 'Plano anual', nome: 'Ana' })).toEqual({
      texto: 'Plano anual',
      provisorio: false,
    })
  })

  it('sem título, diz de quem é o negócio e marca como provisório', () => {
    expect(tituloDoNegocio({ titulo: '  ', nome: 'Ana' })).toEqual({
      texto: 'Negócio de Ana',
      provisorio: true,
    })
    expect(tituloDoNegocio({ nome: '' }).provisorio).toBe(true)
  })
})

describe('degrauDaEtapa', () => {
  const etapas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('conta a partir de 1 e sabe qual é a última', () => {
    expect(degrauDaEtapa(etapas, 'b')).toEqual({ posicao: 2, total: 3, ultima: false })
    expect(degrauDaEtapa(etapas, 'c')?.ultima).toBe(true)
  })

  it('etapa que sumiu não vira degrau falso', () => {
    expect(degrauDaEtapa(etapas, 'x')).toBeNull()
  })
})

describe('dias', () => {
  it('nunca negativo e com a palavra certa', () => {
    const agora = Date.parse('2026-09-24T12:00:00Z')
    expect(diasDesde('2026-09-21T11:00:00Z', agora)).toBe(3)
    expect(diasDesde('2026-09-25T11:00:00Z', agora)).toBe(0)
    expect(comoDias(0)).toBe('hoje')
    expect(comoDias(1)).toBe('1 dia')
    expect(comoDias(12)).toBe('12 dias')
  })
})

describe('histórico do negócio', () => {
  it('classifica os tipos', () => {
    expect(categoriaDoEvento('nota')).toBe('anotacoes')
    expect(categoriaDoEvento('atividade')).toBe('atividades')
    expect(categoriaDoEvento('mudou-de-etapa')).toBe('etapas')
    expect(categoriaDoEvento('perdeu')).toBe('etapas')
    expect(categoriaDoEvento('mensagem-recebida')).toBe('conversa')
    expect(categoriaDoEvento('entrou-no-fluxo')).toBe('automacao')
    expect(categoriaDoEvento('tipo-que-ninguem-conhece')).toBe('automacao')
  })

  it('evento de outro negócio fica de fora; evento da pessoa entra', () => {
    expect(eventoDoNegocio({ cartaoId: 'c1' }, 'c1')).toBe(true)
    expect(eventoDoNegocio({ cartaoId: 'c2' }, 'c1')).toBe(false)
    expect(eventoDoNegocio({}, 'c1')).toBe(true)
  })

  it('filtra por tipo', () => {
    const itens = [{ tipo: 'nota' }, { tipo: 'mudou-de-etapa' }, { tipo: 'mensagem-enviada' }]
    expect(filtrarHistorico(itens, 'tudo')).toHaveLength(3)
    expect(filtrarHistorico(itens, 'etapas')).toEqual([{ tipo: 'mudou-de-etapa' }])
    expect(filtrarHistorico(itens, 'automacao')).toEqual([])
  })
})

describe('fraseDoNegocio', () => {
  it('põe o negócio de sujeito', () => {
    expect(fraseDoNegocio({ tipo: 'perdeu', dados: { motivo: 'preço' } })).toBe('Negócio perdido, preço')
    expect(fraseDoNegocio({ tipo: 'mudou-de-etapa', dados: { de: 'Novo', para: 'Proposta' } })).toBe(
      'Saiu de Novo para Proposta',
    )
  })
})

describe('filtrarNegocios', () => {
  const base = { telefone: '5544999990000', colunaId: 'e1', situacao: 'aberta' }
  const lista = [
    { ...base, titulo: 'Plano anual', nome: 'João', responsavelId: 'u1', temperatura: 'quente' },
    { ...base, titulo: null, nome: 'Maria', colunaId: 'e2', situacao: 'ganha', temperatura: null },
  ]

  it('busca sem acento em título e nome', () => {
    expect(filtrarNegocios(lista, { busca: 'joao' })).toHaveLength(1)
    expect(filtrarNegocios(lista, { busca: 'anual' })).toHaveLength(1)
    expect(filtrarNegocios(lista, { busca: '99999' })).toHaveLength(2)
  })

  it('filtra por etapa, situação, dono e temperatura', () => {
    expect(filtrarNegocios(lista, { etapa: 'e2' })[0]?.nome).toBe('Maria')
    expect(filtrarNegocios(lista, { situacao: 'aberta' })).toHaveLength(1)
    expect(filtrarNegocios(lista, { responsavel: 'ninguem' })[0]?.nome).toBe('Maria')
    expect(filtrarNegocios(lista, { temperatura: 'nenhuma' })[0]?.nome).toBe('Maria')
    expect(filtrarNegocios(lista, {})).toHaveLength(2)
  })
})

describe('fraseDaAtividade', () => {
  it('começa com maiúscula e diz o estado', () => {
    expect(fraseDaAtividade('ligacao', 'aberta', 'confirmar aula')).toBe('Ligação marcada: confirmar aula')
    expect(fraseDaAtividade('tarefa', 'concluida', 'contrato')).toBe('Tarefa feita: contrato')
  })
})
