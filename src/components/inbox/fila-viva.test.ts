import { describe, expect, it } from 'vitest'
import type { Lead } from '@/server/repos/leads'
import { juntarNaPagina, naoLidasVivas } from './fila-viva'

describe('naoLidasVivas', () => {
  it('o número vivo vale por cima do servidor', () => {
    const juntas = naoLidasVivas(new Map([['a', 1]]), new Map([['a', 3], ['b', 2]]))
    expect([...juntas]).toEqual([['a', 3], ['b', 2]])
  })

  it('zero vivo tira a conversa, para o "Não lidas" não contar quem já foi lido', () => {
    const juntas = naoLidasVivas(new Map([['a', 2], ['b', 1]]), new Map([['a', 0], ['c', 0]]))
    expect(juntas.size).toBe(1)
    expect(juntas.get('b')).toBe(1)
  })
})

const linha = (contatoId: string, ultimaEm: string, atribuidoA: string | null = null) =>
  ({ contatoId, ultimaEm, atribuidoA, estadoEfetivo: 'aberta' }) as unknown as Lead

describe('juntarNaPagina', () => {
  const base = [linha('a', '2026-09-25T10:00:00Z'), linha('b', '2026-09-25T09:00:00Z')]
  const todas = () => true

  it('na primeira página, conversa nova entra e a mais recente sobe', () => {
    const vivas = new Map([
      ['c', linha('c', '2026-09-25T11:00:00Z')],
      ['b', linha('b', '2026-09-25T12:00:00Z')],
    ])
    const { leads, novas } = juntarNaPagina(base, vivas, todas, true)
    expect(leads.map((l) => l.contatoId)).toEqual(['b', 'c', 'a'])
    expect(novas).toBe(0)
  })

  it('conversa nova fora do filtro não entra', () => {
    const vivas = new Map([['c', linha('c', '2026-09-25T11:00:00Z', 'outra')]])
    const { leads } = juntarNaPagina(base, vivas, (l) => l.atribuidoA === null, true)
    expect(leads.map((l) => l.contatoId)).toEqual(['a', 'b'])
  })

  it('longe do topo, a página não muda de ordem e conta as novas', () => {
    const vivas = new Map([
      ['c', linha('c', '2026-09-25T11:00:00Z')],
      ['b', linha('b', '2026-09-25T12:00:00Z')],
    ])
    const { leads, novas } = juntarNaPagina(base, vivas, todas, false)
    expect(leads.map((l) => l.contatoId)).toEqual(['a', 'b'])
    expect(leads[1]!.ultimaEm).toBe('2026-09-25T12:00:00Z')
    expect(novas).toBe(1)
  })
})
