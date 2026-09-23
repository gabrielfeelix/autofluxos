import { describe, expect, it } from 'vitest'
import {
  diaDoPrazo,
  fronteirasDoDia,
  intervaloDaVista,
  lerFiltroDaAgenda,
  padraoSemAcento,
  paraParametros,
} from './atividades'

describe('filtro da agenda lido da URL', () => {
  it('sem parâmetro nenhum é abertas, minhas, página 1', () => {
    expect(lerFiltroDaAgenda({})).toEqual({
      situacao: 'aberta', recorte: null, busca: '', tipo: null, responsavel: null, alcance: 'minhas', pagina: 1,
      vista: 'lista', escala: 'semana', dia: '',
    })
  })
  it('valor desconhecido cai no padrão, nunca quebra', () => {
    const f = lerFiltroDaAgenda({ situacao: 'xpto', tipo: 'foguete', pagina: '-3', recorte: 'ontem' })
    expect(f.situacao).toBe('aberta')
    expect(f.tipo).toBeNull()
    expect(f.pagina).toBe(1)
    expect(f.recorte).toBeNull()
  })
  it('busca é aparada e cortada em 80', () => {
    expect(lerFiltroDaAgenda({ q: `  ${'a'.repeat(100)}  ` }).busca).toHaveLength(80)
  })
  it('ida e volta pela URL preserva o filtro e omite o padrão', () => {
    const f = lerFiltroDaAgenda({ q: 'joão', tipo: 'ligacao', alcance: 'equipe', pagina: '3' })
    const p = paraParametros(f)
    expect(p.get('situacao')).toBeNull()
    expect(lerFiltroDaAgenda(Object.fromEntries(p))).toEqual(f)
  })
  it('parâmetro repetido na URL vale o primeiro', () => {
    expect(lerFiltroDaAgenda({ tipo: ['reuniao', 'ligacao'] }).tipo).toBe('reuniao')
  })
})

describe('fronteiras do dia', () => {
  it('seguem o dia UTC, a mesma régua de urgenciaDe', () => {
    const agora = Date.UTC(2026, 8, 23, 23, 30)
    expect(fronteirasDoDia(agora)).toEqual({
      inicioDeHoje: '2026-09-23T00:00:00.000Z',
      inicioDeAmanha: '2026-09-24T00:00:00.000Z',
    })
  })
})

describe('padrão de busca sem acento', () => {
  const casa = (termo: string, texto: string) => new RegExp(padraoSemAcento(termo), 'i').test(texto)
  it('"joao" acha "João" e "João" acha "Joao"', () => {
    expect(casa('joao', 'João Pedro')).toBe(true)
    expect(casa('João', 'Joao')).toBe(true)
    expect(casa('conceicao', 'Conceição')).toBe(true)
  })
  it('caractere especial de regex não vira curinga', () => {
    expect(casa('a.b', 'axb')).toBe(false)
  })
})

describe('vista de calendário', () => {
  const AGORA = Date.UTC(2026, 8, 23, 15, 0) // quarta, 23/09/2026

  it('vista, escala e dia vão e voltam pela URL; dia inválido cai em hoje', () => {
    const f = lerFiltroDaAgenda({ vista: 'agenda', escala: 'mes', dia: '2026-10-05' })
    expect(paraParametros(f).toString()).toBe('vista=agenda&escala=mes&dia=2026-10-05')
    expect(lerFiltroDaAgenda({ vista: 'x', escala: 'ano', dia: '2026-13-45' })).toMatchObject({
      vista: 'lista', escala: 'semana', dia: '',
    })
  })

  it('semana vai de segunda a domingo e anda de 7 em 7', () => {
    const v = intervaloDaVista('semana', '', AGORA)
    expect(v.dias).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'])
    expect(v.de).toBe('2026-09-21T00:00:00.000Z')
    expect(v.ate).toBe('2026-09-28T00:00:00.000Z')
    expect([v.anterior, v.seguinte]).toEqual(['2026-09-16', '2026-09-30'])
  })

  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(intervaloDaVista('semana', '2026-09-27', AGORA).dias[0]).toBe('2026-09-21')
  })

  it('mês é a grade inteira, da segunda antes do dia 1 ao domingo depois do último', () => {
    const v = intervaloDaVista('mes', '2026-09-15', AGORA)
    expect(v.dias[0]).toBe('2026-08-31')
    expect(v.dias.at(-1)).toBe('2026-10-04')
    expect(v.dias).toHaveLength(35)
    expect([v.anterior, v.seguinte]).toEqual(['2026-08-01', '2026-10-01'])
  })

  it('o dia do prazo é o dia UTC, a régua de urgenciaDe', () => {
    expect(diaDoPrazo('2026-09-23T23:30:00.000Z')).toBe('2026-09-23')
    expect(diaDoPrazo('2026-09-24T12:00:00.000Z')).toBe('2026-09-24')
  })
})
