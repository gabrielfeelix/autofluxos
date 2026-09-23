import { describe, expect, it } from 'vitest'
import { lerCsv, lerXlsx, type Linha } from './planilha'

/** Só as células, para os testes que não olham o número da linha. */
const celulas = (linhas: Linha[]) => linhas.map((l) => l.celulas)

describe('lerCsv', () => {
  it('lê ponto e vírgula, o CSV do Excel em português', () => {
    expect(celulas(lerCsv('nome;preco\nPlano Ouro;1.299,90\n'))).toEqual([
      ['nome', 'preco'],
      ['Plano Ouro', '1.299,90'],
    ])
  })

  it('lê vírgula quando o cabeçalho usa vírgula', () => {
    expect(celulas(lerCsv('nome,preco\r\nCadeira,"1.299,90"\r\n'))).toEqual([
      ['nome', 'preco'],
      ['Cadeira', '1.299,90'],
    ])
  })

  it('tira o BOM do começo e respeita aspas com quebra de linha e aspas dobradas', () => {
    const texto = '\uFEFFnome;descricao\n"Mesa";"linha 1\nlinha ""2"""\n'
    expect(celulas(lerCsv(texto))).toEqual([
      ['nome', 'descricao'],
      ['Mesa', 'linha 1\nlinha "2"'],
    ])
  })

  it('ignora linha totalmente vazia e guarda o número da linha real', () => {
    expect(lerCsv('nome\nA\n\n;\nB')).toEqual([
      { linha: 1, celulas: ['nome'] },
      { linha: 2, celulas: ['A'] },
      { linha: 5, celulas: ['B'] },
    ])
  })
})

/** Monta o mínimo de um .xlsx já descompactado. */
function xlsx(celulas: string, compartilhadas: string[] = []) {
  return {
    'xl/workbook.xml':
      '<workbook xmlns:r="r"><sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml':
      '<sst>' + compartilhadas.map((s) => `<si><t xml:space="preserve">${s}</t></si>`).join('') + '</sst>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${celulas}</sheetData></worksheet>`,
  }
}

describe('lerXlsx', () => {
  it('lê texto compartilhado, número e texto em linha, na coluna certa', () => {
    const arquivos = xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="inlineStr"><is><t>Café &amp; cia</t></is></c><c r="C2"><v>1299.9</v></c></row>',
      ['nome', 'preco'],
    )
    expect(celulas(lerXlsx(arquivos))).toEqual([
      ['nome', '', 'preco'],
      ['Café & cia', '', '1299.9'],
    ])
  })

  it('arredonda número com lixo de ponto flutuante para dois decimais', () => {
    const arquivos = xlsx('<row r="1"><c r="A1"><v>10.199999999999999</v></c></row>')
    expect(celulas(lerXlsx(arquivos))).toEqual([['10.20']])
  })

  it('escreve código numérico longo sem notação científica', () => {
    const arquivos = xlsx('<row r="1"><c r="A1"><v>7.891234567890E12</v></c></row>')
    expect(celulas(lerXlsx(arquivos))).toEqual([['7891234567890']])
  })

  it('junta texto rico (vários <r>) numa célula só', () => {
    const arquivos = xlsx('<row r="1"><c r="B1" t="s"><v>0</v></c></row>')
    arquivos['xl/sharedStrings.xml'] = '<sst><si><r><t>Pla</t></r><r><t>no</t></r></si></sst>'
    expect(celulas(lerXlsx(arquivos))).toEqual([['', 'Plano']])
  })

  it('pula linhas vazias do meio e guarda o número da linha real', () => {
    const arquivos = xlsx(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c></row>' +
        '<row r="4"><c r="A4" t="inlineStr"><is><t>b</t></is></c></row>',
    )
    expect(lerXlsx(arquivos)).toEqual([
      { linha: 1, celulas: ['a'] },
      { linha: 4, celulas: ['b'] },
    ])
  })

  it('não engole a linha seguinte depois de uma linha autofechada', () => {
    const arquivos = xlsx(
      '<row r="1" spans="1:1"/>' + '<row r="2"><c r="A2" t="inlineStr"><is><t>b</t></is></c></row>',
    )
    expect(lerXlsx(arquivos)).toEqual([{ linha: 2, celulas: ['b'] }])
  })

  it('recusa arquivo que não é planilha', () => {
    expect(() => lerXlsx({})).toThrow(/planilha/)
  })
})
