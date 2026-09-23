import { describe, expect, it } from 'vitest'
import { fronteirasDoDia, lerFiltroDaAgenda, padraoSemAcento, paraParametros } from './atividades'

describe('filtro da agenda lido da URL', () => {
  it('sem parâmetro nenhum é abertas, minhas, página 1', () => {
    expect(lerFiltroDaAgenda({})).toEqual({
      situacao: 'aberta', recorte: null, busca: '', tipo: null, responsavel: null, alcance: 'minhas', pagina: 1,
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
