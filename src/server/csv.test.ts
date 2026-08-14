import { describe, expect, it } from 'vitest'
import { celulaCsv, montarCsv, nomeDoArquivo } from './csv'

describe('csv', () => {
  it('põe tudo entre aspas e dobra as aspas de dentro', () => {
    expect(celulaCsv('simples')).toBe('"simples"')
    expect(celulaCsv('ele disse "oi"')).toBe('"ele disse ""oi"""')
    expect(celulaCsv(null)).toBe('""')
  })

  it('quebra de linha e vírgula não desalinham o arquivo', () => {
    const arquivo = montarCsv(['texto'], [['linha um\nlinha dois, com vírgula']])
    expect(arquivo).toContain('"linha um\nlinha dois, com vírgula"')
  })

  /**
   * O conteúdo vem do WhatsApp de estranhos. Célula começando com `=` é
   * fórmula executada ao abrir a planilha — a aspa simples na frente é o que a
   * planilha entende como "isto é texto".
   */
  it('não deixa a planilha executar o que o lead escreveu', () => {
    expect(celulaCsv('=HYPERLINK("http://mau","clique")')).toBe(
      '"\'=HYPERLINK(""http://mau"",""clique"")"',
    )
    expect(celulaCsv('+1+1')).toBe('"\'+1+1"')
    expect(celulaCsv('-2')).toBe('"\'-2"')
    expect(celulaCsv('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    // Telefone com DDI continua telefone: o `+` some para a planilha, não o dado.
    expect(celulaCsv('+5544999990000')).toContain('+5544999990000')
  })

  it('começa com BOM para o Excel não comer os acentos', () => {
    expect(montarCsv(['nome'], [['João']]).startsWith('﻿')).toBe(true)
  })

  it('separa linhas como o RFC 4180 pede', () => {
    expect(montarCsv(['a', 'b'], [['1', '2']])).toBe('﻿"a","b"\r\n"1","2"\r\n')
  })

  it('nomeia o arquivo com o cliente para não virar leads(3).csv', () => {
    expect(nomeDoArquivo('leads', 'Estúdio da Ação!', '2026-08-14')).toBe(
      'leads-estudio-da-acao-2026-08-14.csv',
    )
    expect(nomeDoArquivo('leads', '???', '2026-08-14')).toBe('leads-cliente-2026-08-14.csv')
  })
})
