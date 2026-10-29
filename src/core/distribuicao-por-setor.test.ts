import { describe, expect, it } from 'vitest'
import { decidirDistribuicao } from './distribuicao-por-setor'
import type { Candidato } from './rodizio'

const pessoa = (usuarioId: string, extra: Partial<Candidato> = {}): Candidato => ({
  usuarioId,
  papel: 'member',
  presenca: 'disponivel',
  abertas: 0,
  entraNoRodizio: null,
  tetoSimultaneo: null,
  ...extra,
})

const equipe = [pessoa('ana', { abertas: 3 }), pessoa('bia', { abertas: 1 }), pessoa('caio', { abertas: 0 })]
const suporte = new Set(['ana', 'bia'])

describe('decidirDistribuicao', () => {
  it('sem setor, a carteira ganha como antes', () => {
    expect(decidirDistribuicao({ dono: 'caio', membrosDoSetor: null, candidatos: equipe, modo: 'balanceado' })).toEqual({
      tipo: 'manter',
    })
  })

  it('sem setor e sem dono, rodízio da conta inteira', () => {
    expect(decidirDistribuicao({ dono: null, membrosDoSetor: null, candidatos: equipe, modo: 'balanceado' })).toEqual({
      tipo: 'atribuir',
      usuarioId: 'caio',
    })
  })

  it('com setor, só membro do setor recebe', () => {
    expect(decidirDistribuicao({ dono: null, membrosDoSetor: suporte, candidatos: equipe, modo: 'balanceado' })).toEqual({
      tipo: 'atribuir',
      usuarioId: 'bia',
    })
  })

  it('dono do setor continua com a conversa', () => {
    expect(decidirDistribuicao({ dono: 'ana', membrosDoSetor: suporte, candidatos: equipe, modo: 'balanceado' })).toEqual({
      tipo: 'manter',
    })
  })

  it('carteira não fura setor: dono de fora perde para o rodízio do setor', () => {
    expect(decidirDistribuicao({ dono: 'caio', membrosDoSetor: suporte, candidatos: equipe, modo: 'balanceado' })).toEqual({
      tipo: 'atribuir',
      usuarioId: 'bia',
    })
  })

  it('dono de fora e setor sem ninguém apto: solta para a fila do setor', () => {
    const ausentes = equipe.map((c) => (suporte.has(c.usuarioId) ? { ...c, presenca: 'ausente' } : c))
    expect(decidirDistribuicao({ dono: 'caio', membrosDoSetor: suporte, candidatos: ausentes, modo: 'balanceado' })).toEqual({
      tipo: 'soltar',
    })
  })

  it('distribuição manual com setor: dono de fora solta, ninguém é escolhido', () => {
    expect(decidirDistribuicao({ dono: 'caio', membrosDoSetor: suporte, candidatos: [], modo: 'balanceado' })).toEqual({
      tipo: 'soltar',
    })
    expect(decidirDistribuicao({ dono: null, membrosDoSetor: suporte, candidatos: [], modo: 'balanceado' })).toEqual({
      tipo: 'manter',
    })
  })

  it('gestor posto no setor entra no rodízio dele, a menos que a conta tenha tirado', () => {
    const dono = pessoa('dono', { papel: 'owner' })
    const financeiro = new Set(['dono'])
    expect(decidirDistribuicao({ dono: null, membrosDoSetor: financeiro, candidatos: [dono], modo: 'balanceado' })).toEqual({
      tipo: 'atribuir',
      usuarioId: 'dono',
    })
    expect(
      decidirDistribuicao({
        dono: null,
        membrosDoSetor: financeiro,
        candidatos: [{ ...dono, entraNoRodizio: false }],
        modo: 'balanceado',
      }),
    ).toEqual({ tipo: 'manter' })
  })
})
