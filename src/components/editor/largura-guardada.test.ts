import { describe, expect, it } from 'vitest'
import { larguraValida } from './largura-guardada'

/**
 * As três respostas erradas aqui são silenciosas, e é por isso que elas têm
 * teste: `null` de quem nunca escolheu, `NaN` de um valor corrompido à mão, e um
 * número absurdo sobrando de uma versão anterior com outros limites. Nenhuma
 * estoura — todas viram uma largura de painel, certa ou impossível.
 */
const limites = { padrao: 232, minima: 132, maxima: 380 }

describe('larguraValida', () => {
  it('quem nunca escolheu fica com o padrão', () => {
    expect(larguraValida(null, limites)).toBe(232)
  })

  it('lixo no armazenamento vira o padrão, e não NaN na folha de estilo', () => {
    expect(larguraValida('abc', limites)).toBe(232)
    expect(larguraValida('', limites)).toBe(232)
    expect(larguraValida('-40', limites)).toBe(232)
  })

  // Um valor de uma versão anterior, com outros limites, não pode virar um
  // painel de 900px que come o desenho inteiro.
  it('valor fora dos limites volta para dentro deles', () => {
    expect(larguraValida('9999', limites)).toBe(380)
    expect(larguraValida('10', limites)).toBe(132)
  })

  it('o que está dentro passa, arredondado', () => {
    expect(larguraValida('200', limites)).toBe(200)
    expect(larguraValida('200.6', limites)).toBe(201)
  })
})
