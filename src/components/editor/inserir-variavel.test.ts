import { describe, expect, it } from 'vitest'
import { inserirNoCursor } from './inserir-variavel'

describe('inserirNoCursor', () => {
  it('insere no cursor sem apagar o restante do texto', () => {
    expect(inserirNoCursor('Oi, !', 4, 4, '{{nome}}')).toEqual({
      proximo: 'Oi, {{nome}}!',
      cursor: 12,
    })
  })

  it('substitui apenas a seleção atual', () => {
    expect(inserirNoCursor('Olá, cliente', 5, 12, '{{nome}}')).toEqual({
      proximo: 'Olá, {{nome}}',
      cursor: 13,
    })
  })

  it('não deixa cursor vindo de fora do campo quebrar o texto', () => {
    expect(inserirNoCursor('Oi', -5, 99, '{{nome}}')).toEqual({
      proximo: '{{nome}}',
      cursor: 8,
    })
  })
})
