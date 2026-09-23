import { describe, expect, it } from 'vitest'
import { lerProdutosDaPlanilha, planejarImportacao, type ItemDaPlanilha } from './importar-produtos'
import type { Linha } from './planilha'

function planilha(...linhas: string[][]): Linha[] {
  return linhas.map((celulas, i) => ({ linha: i + 1, celulas }))
}

const CABECALHO = ['Nome', 'Tipo', 'SKU', 'Preço', 'Descrição', 'Link', 'Foto']

function lidos(...linhas: string[][]) {
  const r = lerProdutosDaPlanilha(planilha(CABECALHO, ...linhas))
  if (!r.ok) throw new Error(r.motivo)
  return r
}

describe('lerProdutosDaPlanilha', () => {
  it('lê as colunas pelo nome, sem caixa e sem acento, em qualquer ordem', () => {
    const r = lerProdutosDaPlanilha(
      planilha(['preco', 'NOME', 'descricao'], ['1.299,90', 'Cadeira Sentinel', 'Ergonômica']),
    )
    expect(r).toEqual({
      ok: true,
      erros: [],
      itens: [
        {
          linha: 2,
          nome: 'Cadeira Sentinel',
          especie: null,
          sku: null,
          preco: 1299.9,
          descricao: 'Ergonômica',
          link: null,
          foto: null,
        },
      ],
    })
  })

  it('aceita preço brasileiro e com ponto decimal', () => {
    const r = lidos(['A', '', '', '1.299,90'], ['B', '', '', '1299.90'], ['C', '', '', ''])
    expect(r.itens.map((i) => i.preco)).toEqual([1299.9, 1299.9, null])
  })

  it('aceita serviço com e sem acento, e produto', () => {
    const r = lidos(['A', 'serviço'], ['B', 'Servico'], ['C', 'PRODUTO'], ['D', ''])
    expect(r.itens.map((i) => i.especie)).toEqual(['servico', 'servico', 'produto', null])
  })

  it('linha com erro diz qual linha e por quê, e não derruba as outras', () => {
    const r = lidos(
      ['Bom', 'produto', 'X1', '10'],
      ['', 'produto'],
      ['Tipo ruim', 'brinde'],
      ['Preço ruim', '', '', 'dez reais'],
      ['Foto ruim', '', '', '', '', '', 'http://site/foto.png'],
      ['Link ruim', '', '', '', '', 'site.com.br/x'],
      ['Também bom', 'servico'],
    )
    expect(r.itens.map((i) => i.nome)).toEqual(['Bom', 'Também bom'])
    expect(r.erros).toEqual([
      { linha: 3, motivo: 'dê um nome ao item do catálogo' },
      { linha: 4, motivo: 'o tipo precisa ser "produto" ou "serviço"' },
      { linha: 5, motivo: 'preço: escreva só o número, como 1.500 ou 1500,00' },
      { linha: 6, motivo: 'a foto precisa ser um endereço que começa com https://' },
      { linha: 7, motivo: 'o link precisa ser um endereço que começa com https://' },
    ])
  })

  it('sku ou nome repetido na mesma planilha é erro na segunda aparição', () => {
    const r = lidos(['A', '', 'ab-1'], ['B', '', ' AB-1 '], ['C'], ['c'])
    expect(r.itens.map((i) => i.nome)).toEqual(['A', 'C'])
    expect(r.erros).toEqual([
      { linha: 3, motivo: 'o SKU "AB-1" já apareceu na linha 2' },
      { linha: 5, motivo: 'o nome "c" já apareceu na linha 4' },
    ])
  })

  it('recusa planilha sem coluna de nome', () => {
    expect(lerProdutosDaPlanilha(planilha(['item', 'valor'], ['A', '1']))).toEqual({
      ok: false,
      motivo: 'a primeira linha precisa ter uma coluna "nome"',
    })
  })

  it('recusa planilha só com o cabeçalho', () => {
    expect(lerProdutosDaPlanilha(planilha(CABECALHO))).toEqual({
      ok: false,
      motivo: 'a planilha não tem nenhuma linha de produto embaixo do cabeçalho',
    })
  })
})

function item(parcial: Partial<ItemDaPlanilha> & { nome: string; linha: number }): ItemDaPlanilha {
  return { especie: null, sku: null, preco: null, descricao: null, link: null, foto: null, ...parcial }
}

describe('planejarImportacao', () => {
  const existentes = [
    { id: 'p1', nome: 'Cadeira Sentinel', sku: 'CAD-1' },
    { id: 'p2', nome: 'Headset', sku: null },
  ]

  it('casa por SKU, senão por nome, e o resto entra como novo', () => {
    const plano = planejarImportacao(
      [
        item({ linha: 2, nome: 'Cadeira Sentinel Preta', sku: 'cad-1' }),
        item({ linha: 3, nome: 'headset', preco: 199 }),
        item({ linha: 4, nome: 'Mouse', sku: 'MS-1' }),
      ],
      existentes,
    )
    expect(plano.atualizar.map((a) => [a.id, a.item.linha])).toEqual([
      ['p1', 2],
      ['p2', 3],
    ])
    expect(plano.criar.map((i) => i.nome)).toEqual(['Mouse'])
    expect(plano.erros).toEqual([])
  })

  it('recusa renomear um item para o nome de outro que já existe', () => {
    const plano = planejarImportacao(
      [item({ linha: 2, nome: 'Headset', sku: 'CAD-1' })],
      existentes,
    )
    expect(plano.atualizar).toEqual([])
    expect(plano.erros).toEqual([
      { linha: 2, motivo: 'já existe outro item chamado "Headset" no catálogo' },
    ])
  })

  it('recusa duas linhas caindo no mesmo item do catálogo', () => {
    const plano = planejarImportacao(
      [
        item({ linha: 2, nome: 'Cadeira nova', sku: 'CAD-1' }),
        item({ linha: 3, nome: 'Cadeira Sentinel' }),
      ],
      existentes,
    )
    expect(plano.atualizar.map((a) => a.id)).toEqual(['p1'])
    expect(plano.erros).toEqual([
      { linha: 3, motivo: 'esta linha e a linha 2 atualizariam o mesmo item do catálogo' },
    ])
  })
})
