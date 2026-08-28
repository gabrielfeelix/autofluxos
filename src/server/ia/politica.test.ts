import { describe, expect, it } from 'vitest'
import { ferramentasPermitidas } from '@/core/ferramentas'
import { PADRAO_DE_ESCRITA, PADRAO_DE_LEITURA, politicaDe, type Politica } from './politica'

/**
 * Quem decide se a IA grava sozinha.
 *
 * O que precisa ser provado é o padrão: o cliente que nunca foi configurado —
 * inclusive o que já existia antes desta tabela — tem que nascer do lado
 * seguro, sem ninguém lembrar de configurá-lo.
 */

const marcar = ferramentasPermitidas(['agenda_marcar'])[0]!
const horarios = ferramentasPermitidas(['agenda_horarios'])[0]!

describe('o padrão protege quem nunca foi configurado', () => {
  it('gravação começa exigindo confirmação', () => {
    expect(politicaDe(marcar, new Map())).toBe('confirmar')
    expect(PADRAO_DE_ESCRITA).toBe('confirmar')
  })

  it('leitura é sempre automática', () => {
    expect(politicaDe(horarios, new Map())).toBe('automatico')
    expect(PADRAO_DE_LEITURA).toBe('automatico')
  })
})

describe('a linha gravada vale, e só para gravação', () => {
  it('o cliente que dispensou a pergunta grava sozinho', () => {
    const gravadas = new Map<string, Politica>([['agenda_marcar', 'automatico']])
    expect(politicaDe(marcar, gravadas)).toBe('automatico')
  })

  it('o cliente que quer funcionário no meio pede humano', () => {
    const gravadas = new Map<string, Politica>([['agenda_marcar', 'humano']])
    expect(politicaDe(marcar, gravadas)).toBe('humano')
  })

  it('política de leitura gravada por engano é ignorada', () => {
    // O `check` do banco já recusa. Esta é a segunda porta, e ela existe porque
    // a consequência de uma linha errada seria a IA emudecer numa consulta
    // inofensiva — e ninguém suspeitaria da tabela.
    const gravadas = new Map<string, Politica>([['agenda_horarios', 'humano']])
    expect(politicaDe(horarios, gravadas)).toBe('automatico')
  })

  it('linha de outra ferramenta não vaza para esta', () => {
    const gravadas = new Map<string, Politica>([['agenda_desmarcar', 'automatico']])
    expect(politicaDe(marcar, gravadas)).toBe('confirmar')
  })
})

describe('toda ferramenta que grava sabe o que dizer na pergunta', () => {
  it('tem `acao`, senão a confirmação sai vaga', () => {
    // "Posso?" sem dizer o quê recebe um "pode" que não confirma nada.
    for (const f of ferramentasPermitidas(['agenda_marcar', 'agenda_desmarcar'])) {
      expect(f.acao).toBeTruthy()
      expect(f.acao!.length).toBeGreaterThan(5)
    }
  })
})
