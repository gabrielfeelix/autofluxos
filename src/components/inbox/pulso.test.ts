import { describe, expect, it } from 'vitest'
import { precisaAtualizar } from './pulso'

const T1 = '2026-09-03T03:00:00+00:00'
const T2 = '2026-09-03T03:05:00+00:00'

describe('quando o Inbox precisa se atualizar', () => {
  it('banco igual à tela: não faz nada', () => {
    expect(precisaAtualizar({ doBanco: T1, naTela: T1, jaPedido: null })).toBe(false)
  })

  it('chegou mensagem nova: atualiza', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T1, jaPedido: null })).toBe(true)
  })

  it('não pede o mesmo refresh duas vezes enquanto a tela nova não chega', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T1, jaPedido: T2 })).toBe(false)
  })

  /*
   * O bug que derrubou a primeira versão: o componente remonta a cada refresh.
   * Se a decisão dependesse da memória dele, aqui devolveria `false` para
   * sempre e a tela nunca sairia do lugar. Como ela compara contra a tela,
   * um segundo carimbo novo dispara igual ao primeiro.
   */
  it('sobrevive a remontagem: memória zerada não impede a próxima atualização', () => {
    expect(precisaAtualizar({ doBanco: T2, naTela: T1, jaPedido: null })).toBe(true)
  })

  it('conta que ainda não tem mensagem nenhuma fica quieta', () => {
    expect(precisaAtualizar({ doBanco: null, naTela: null, jaPedido: null })).toBe(false)
  })

  it('a primeira mensagem da conta também atualiza', () => {
    expect(precisaAtualizar({ doBanco: T1, naTela: null, jaPedido: null })).toBe(true)
  })
})
