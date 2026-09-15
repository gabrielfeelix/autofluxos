import { describe, expect, it } from 'vitest'
import { avanca, type EstadoDoDestinatario } from './transmissoes'

/**
 * Só a ordem dos estados. É lógica pura e não toca no banco — mas é a regra
 * que, errada, faz a tela mentir para o usuário enquanto ele olha.
 */
describe('os webhooks de status chegam fora de ordem', () => {
  it('deixa avançar na ordem natural', () => {
    expect(avanca('na_fila', 'aceita')).toBe(true)
    expect(avanca('aceita', 'entregue')).toBe(true)
    expect(avanca('entregue', 'lida')).toBe(true)
  })

  /*
   * `read` antes de `delivered` é comum na Meta. Quem grava o último que chegou
   * faz uma mensagem lida voltar para "entregue" na tela.
   */
  it('não deixa "lida" voltar para "entregue"', () => {
    expect(avanca('lida', 'entregue')).toBe(false)
  })

  it('não regride para a fila nem repete o mesmo estado', () => {
    expect(avanca('entregue', 'na_fila')).toBe(false)
    expect(avanca('entregue', 'entregue')).toBe(false)
  })

  /*
   * A falha que chega depois é a Meta se corrigindo: tipicamente a mensagem
   * retida que foi descartada (132015). Essa correção tem que vencer, senão a
   * campanha aparece como entregue e ninguém recebeu.
   */
  it('deixa a falha vencer qualquer estado anterior', () => {
    const antes: EstadoDoDestinatario[] = ['na_fila', 'aceita', 'retida', 'entregue', 'lida']
    for (const estado of antes) {
      expect(avanca(estado, 'falhou')).toBe(true)
    }
  })

  it('não deixa nada sobrescrever uma falha', () => {
    expect(avanca('falhou', 'entregue')).toBe(false)
    expect(avanca('falhou', 'lida')).toBe(false)
  })

  /*
   * `retida` e `aceita` são o mesmo degrau: as duas significam "a Meta recebeu
   * o pedido". Nenhuma das duas substitui a outra, porque a diferença entre
   * elas não vem de webhook — vem da resposta do envio.
   */
  it('trata retida e aceita como o mesmo degrau', () => {
    expect(avanca('aceita', 'retida')).toBe(false)
    expect(avanca('retida', 'aceita')).toBe(false)
    expect(avanca('retida', 'entregue')).toBe(true)
  })
})
