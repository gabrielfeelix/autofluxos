import { describe, expect, it } from 'vitest'
import { lerProdutosDaPlanilha } from './importar-produtos'
import { csvDoModelo, xlsxDoModelo } from './modelo-de-produtos'
import { lerCsv, lerXlsx } from './planilha'

describe('modelo de planilha de produtos', () => {
  it('o CSV do modelo volta pela importação com os 3 exemplos e nenhum erro', () => {
    const r = lerProdutosDaPlanilha(lerCsv(csvDoModelo()))
    expect(r.ok && r.erros).toEqual([])
    expect(r.ok && r.itens.map((i) => [i.nome, i.especie, i.preco])).toEqual([
      ['Cadeira Gamer Sentinel', 'produto', 1299.9],
      ['Avaliação física', 'servico', 150],
      ['Consultoria sob medida', 'servico', null],
    ])
  })

  it('o .xlsx do modelo volta igual ao CSV', () => {
    const doXlsx = lerProdutosDaPlanilha(lerXlsx(xlsxDoModelo()))
    const doCsv = lerProdutosDaPlanilha(lerCsv(csvDoModelo()))
    expect(doXlsx).toEqual(doCsv)
  })
})
