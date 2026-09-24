import { describe, expect, it } from 'vitest'
import {
  completarMeses,
  lerAbaDeVendas,
  maiorPerda,
  mesCurto,
  mesesAte,
  mesNoPeriodo,
  ordenarMotivos,
  passagemPorEtapa,
  SEM_MOTIVO,
  taxaDeVitoria,
  ticketMedio,
  type EtapaDoFunil,
} from './analise-de-vendas'

describe('taxa e ticket', () => {
  it('taxa de vitória é ganhos sobre fechados; nada fechado é sem dado', () => {
    expect(taxaDeVitoria(3, 1)).toBe(75)
    expect(taxaDeVitoria(0, 4)).toBe(0)
    expect(taxaDeVitoria(0, 0)).toBeNull()
  })

  it('ticket médio divide só pelos ganhos com valor', () => {
    expect(ticketMedio(900, 3)).toBe(300)
    expect(ticketMedio(null, 2)).toBeNull()
    expect(ticketMedio(100, 0)).toBeNull()
  })

  it('aba desconhecida cai em Receita', () => {
    expect(lerAbaDeVendas('equipe')).toBe('equipe')
    expect(lerAbaDeVendas('x')).toBe('receita')
    expect(lerAbaDeVendas(undefined)).toBe('receita')
  })
})

describe('meses', () => {
  it('doze meses terminando no mês do fim, atravessando o ano', () => {
    const meses = mesesAte('2026-02-10')
    expect(meses).toHaveLength(12)
    expect(meses[0]).toBe('2025-03')
    expect(meses[11]).toBe('2026-02')
  })

  it('mês sem ganho aparece com zero', () => {
    expect(completarMeses([{ mes: '2026-08', ganhos: 2, valor: 50 }], ['2026-07', '2026-08'])).toEqual([
      { mes: '2026-07', ganhos: 0, valor: null },
      { mes: '2026-08', ganhos: 2, valor: 50 },
    ])
  })

  it('nome curto e mês dentro do período', () => {
    expect(mesCurto('2026-09')).toBe('set')
    expect(mesCurto('2026-09', true)).toBe('set/26')
    expect(mesNoPeriodo('2026-07', '2026-06-27', '2026-09-24')).toBe(true)
    expect(mesNoPeriodo('2026-05', '2026-06-27', '2026-09-24')).toBe(false)
  })
})

describe('passagem de etapa a etapa', () => {
  const etapas: EtapaDoFunil[] = [
    { id: 'a', nome: 'Novo', ordem: 0, tipo: 'normal' },
    { id: 'b', nome: 'Aula', ordem: 1, tipo: 'normal' },
    { id: 'p', nome: 'Perdido', ordem: 9, tipo: 'perdido' },
    { id: 'c', nome: 'Proposta', ordem: 2, tipo: 'normal' },
    { id: 'd', nome: 'Matriculado', ordem: 3, tipo: 'ganho' },
  ]

  it('chegar é ter estado ali ou adiante; ganho chegou ao fim; perdido não é degrau', () => {
    const p = passagemPorEtapa(etapas, [
      { maiorOrdem: 0, ganho: false, n: 5 },
      { maiorOrdem: 2, ganho: false, n: 2 },
      { maiorOrdem: null, ganho: false, n: 1 },
      { maiorOrdem: 3, ganho: true, n: 2 },
    ])
    expect(p.map((x) => x.etapa.nome)).toEqual(['Novo', 'Aula', 'Proposta', 'Matriculado'])
    expect(p.map((x) => x.chegaram)).toEqual([10, 4, 4, 2])
    expect(p.map((x) => x.taxa)).toEqual([40, 100, 50, null])
    expect(maiorPerda(p)).toBe(0)
  })

  it('sem negócio nenhum não aponta perda', () => {
    const p = passagemPorEtapa(etapas, [])
    expect(p.every((x) => x.chegaram === 0)).toBe(true)
    expect(maiorPerda(p)).toBeNull()
  })
})

describe('motivos de perda', () => {
  it('do mais comum ao menos, sem motivo por último', () => {
    expect(
      ordenarMotivos([
        { motivo: null, n: 9 },
        { motivo: 'Preço', n: 2 },
        { motivo: 'Sem resposta', n: 5 },
      ]).map((m) => m.rotulo),
    ).toEqual(['Sem resposta', 'Preço', SEM_MOTIVO])
  })
})
