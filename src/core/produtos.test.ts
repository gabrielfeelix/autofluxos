import { describe, expect, it } from 'vitest'
import {
  conferirNome,
  conferirPreco,
  ehEspecie,
  estaAtivo,
  selecionaveis,
  temPrecoInformado,
  type Produto,
} from './produtos'

function produto(parcial: Partial<Produto> = {}): Produto {
  return {
    id: 'p1',
    nome: 'Plano Ouro',
    especie: 'produto',
    preco: null,
    sku: null,
    descricao: null,
    link: null,
    foto: null,
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

describe('conferirPreco', () => {
  it('em branco é "não informado", e não zero', () => {
    // A distinção inteira da 0091 mora neste teste: se `''` virasse 0, o bot
    // anunciaria "de graça" todo item que o dono ainda não cadastrou.
    expect(conferirPreco('')).toEqual({ ok: true, preco: null })
    expect(conferirPreco('   ')).toEqual({ ok: true, preco: null })
  })

  it('zero é preço válido, para brinde e plano gratuito', () => {
    expect(conferirPreco('0')).toEqual({ ok: true, preco: 0 })
  })

  it('entende as três grafias, porque é o mesmo parser do valor da venda', () => {
    expect(conferirPreco('1.500')).toEqual({ ok: true, preco: 1500 })
    expect(conferirPreco('1.50')).toEqual({ ok: true, preco: 1.5 })
    expect(conferirPreco('R$ 150,00')).toEqual({ ok: true, preco: 150 })
  })

  it('recusa o que não é número', () => {
    expect(conferirPreco('caro').ok).toBe(false)
  })

  it('recusa preço que não caberia na coluna', () => {
    // numeric(12, 2) guarda dez dígitos antes da vírgula. Preço nessa ordem de
    // grandeza é dedo escorregado, não oferta.
    expect(conferirPreco('999999999').ok).toBe(true)
    expect(conferirPreco('99999999999').ok).toBe(false)
  })
})

describe('temPrecoInformado', () => {
  it('separa "não cadastrou" de "é de graça"', () => {
    expect(temPrecoInformado(produto({ preco: null }))).toBe(false)
    expect(temPrecoInformado(produto({ preco: 0 }))).toBe(true)
    expect(temPrecoInformado(produto({ preco: 150 }))).toBe(true)
  })
})
