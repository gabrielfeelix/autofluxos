import { describe, expect, it } from 'vitest'
import {
  conferirNome,
  ehEspecie,
  estaAtivo,
  selecionaveis,
  type Produto,
} from './produtos'

function produto(parcial: Partial<Produto> = {}): Produto {
  return {
    id: 'p1',
    nome: 'Plano Ouro',
    especie: 'produto',
    arquivadoEm: null,
    ...parcial,
  }
}

describe('ehEspecie', () => {
  it('aceita as duas espécies e recusa o resto', () => {
    expect(ehEspecie('produto')).toBe(true)
    expect(ehEspecie('servico')).toBe(true)
    expect(ehEspecie('serviço')).toBe(false)
    expect(ehEspecie(null)).toBe(false)
  })
})

describe('conferirNome', () => {
  it('apara as pontas em vez de recusar', () => {
    const conferido = conferirNome('  Plano Ouro  ')
    expect(conferido).toEqual({ ok: true, nome: 'Plano Ouro' })
  })

  it('recusa nome que é só espaço', () => {
    expect(conferirNome('   ').ok).toBe(false)
  })

  it('recusa nome que não caberia na linha do histórico', () => {
    // 120 passa, 121 não: o nome vira `venda_itens.descricao` e coluna de CSV.
    expect(conferirNome('a'.repeat(120)).ok).toBe(true)
    expect(conferirNome('a'.repeat(121)).ok).toBe(false)
  })
})

describe('estaAtivo', () => {
  it('arquivado não está ativo, mas continua legível', () => {
    expect(estaAtivo(produto())).toBe(true)
    expect(estaAtivo(produto({ arquivadoEm: '2026-09-01T00:00:00Z' }))).toBe(false)
  })
})

describe('selecionaveis', () => {
  it('esconde o arquivado da escolha sem sumir com ele da lista', () => {
    const lista = [
      produto({ id: 'ativo' }),
      produto({ id: 'velho', arquivadoEm: '2026-03-01T00:00:00Z' }),
    ]

    // O ponto: `selecionaveis` filtra, a lista original não muda. Quem lê uma
    // venda de março precisa do nome do item arquivado depois.
    expect(selecionaveis(lista).map((p) => p.id)).toEqual(['ativo'])
    expect(lista).toHaveLength(2)
  })
})
