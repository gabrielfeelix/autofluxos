import { describe, expect, it } from 'vitest'
import { precisaAtualizar } from './pulso'

const T1 = '2026-09-03T03:00:00+00:00'
const T2 = '2026-09-03T03:05:00+00:00'

describe('quando o Inbox precisa se atualizar', () => {
  it('banco igual à tela: não faz nada', () => {
    expect(precisaAtualizar({ doBanco: T1, naTela: T1 })).toBe(false)
  })

  it('chegou mensagem nova: atualiza', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T1 })).toBe(true)
  })

  /*
   * A trava que congelou o Inbox: a versão anterior lembrava "já pedi refresh
   * para T2" e parava de pedir. Se esse refresh não chegasse à tela — e basta
   * uma vez —, a comparação devolvia `false` para sempre.
   *
   * Insistir é o comportamento certo: enquanto a tela estiver velha, ela
   * precisa ser atualizada, não importa quantas vezes já tentamos.
   */
  it('insiste enquanto a tela continuar velha', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T1 })).toBe(true)
    expect(precisaAtualizar({ doBanco: T2, naTela: T1 })).toBe(true)
    expect(precisaAtualizar({ doBanco: T2, naTela: T1 })).toBe(true)
  })

  it('para de insistir assim que a tela alcança o banco', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T2 })).toBe(false)
  })

  it('conta sem mensagem nenhuma fica quieta', () => {
    expect(precisaAtualizar({ doBanco: null, naTela: null })).toBe(false)
  })

  it('a primeira mensagem da conta também atualiza', () => {
    expect(precisaAtualizar({ doBanco: T1, naTela: null })).toBe(true)
  })
})
