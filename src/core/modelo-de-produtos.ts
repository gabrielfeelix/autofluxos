/**
 * O modelo de planilha que a tela de Produtos oferece para baixar.
 *
 * Gerado por código e não guardado como arquivo, para o modelo e a leitura
 * nunca discordarem: as colunas vêm de `COLUNAS_DO_MODELO`, e o teste lê o
 * modelo de volta pela importação. Um `.xlsx` binário no repositório
 * envelheceria calado no dia em que uma coluna mudasse.
 *
 * Puro. Quem compacta o `.xlsx` (é um zip) é a rota de download.
 */

import { COLUNAS_DO_MODELO } from './importar-produtos'

type Exemplo = Record<(typeof COLUNAS_DO_MODELO)[number], string | number>

/** Um produto completo, um serviço sem foto, um serviço sem preço. */
const EXEMPLOS: Exemplo[] = [
  {
    nome: 'Cadeira Gamer Sentinel',
    tipo: 'produto',
    categoria: 'Cadeiras',
    sku: 'CAD-001',
    preco: 1299.9,
    descricao: 'Cadeira ergonômica, apoio de braço 4D, até 150 kg',
    link: 'https://www.sualoja.com.br/cadeira-sentinel',
    foto: 'https://www.sualoja.com.br/fotos/cadeira-sentinel.jpg',
  },
  {
    nome: 'Avaliação física',
    tipo: 'serviço',
    categoria: 'Serviços',
    sku: 'SRV-01',
    preco: 150,
    descricao: 'Avaliação de 40 minutos com profissional',
    link: 'https://www.sualoja.com.br/avaliacao',
    foto: '',
  },
  {
    nome: 'Consultoria sob medida',
    tipo: 'serviço',
    categoria: 'Serviços',
    sku: '',
    preco: '',
    descricao: 'Preço combinado na conversa',
    link: '',
    foto: '',
  },
]

/** "1.299,90": o preço como quem abre o CSV no Excel em português espera ver. */
function precoBr(valor: number): string {
  const [inteiro = '0', centavos = '00'] = valor.toFixed(2).split('.')
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`
}

function celulaCsv(valor: string): string {
  return /[;"\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

/**
 * CSV com ponto e vírgula e BOM: é o que o Excel em português abre certo com
 * um clique duplo, acentos e colunas no lugar. Sem o BOM o "ç" vira lixo.
 */
export function csvDoModelo(): string {
  const linhas = [
    COLUNAS_DO_MODELO.join(';'),
    ...EXEMPLOS.map((e) =>
      COLUNAS_DO_MODELO.map((c) => {
        const v = e[c]
        return celulaCsv(typeof v === 'number' ? precoBr(v) : v)
      }).join(';'),
    ),
  ]
  return '\uFEFF' + linhas.join('\r\n') + '\r\n'
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function letra(indice: number): string {
  return String.fromCharCode(65 + indice)
}

/**
 * Os arquivos de dentro de um `.xlsx` mínimo, caminho para conteúdo.
 *
 * Texto vai como `inlineStr` (dispensa a tabela de textos compartilhados) e
 * preço vai como número com formato `#,##0.00`, para a pessoa poder somar e
 * ordenar a coluna no Excel.
 */
export function xlsxDoModelo(): Record<string, string> {
  const celula = (valor: string | number, col: number, lin: number) => {
    const ref = `${letra(col)}${lin}`
    if (typeof valor === 'number') return `<c r="${ref}" s="2"><v>${valor}</v></c>`
    if (valor === '') return ''
    return `<c r="${ref}" t="inlineStr"${lin === 1 ? ' s="1"' : ''}><is><t>${escaparXml(valor)}</t></is></c>`
  }
  const cabecalho = `<row r="1">${COLUNAS_DO_MODELO.map((c, i) => celula(c, i, 1)).join('')}</row>`
  const corpo = EXEMPLOS.map(
    (e, n) => `<row r="${n + 2}">${COLUNAS_DO_MODELO.map((c, i) => celula(e[c], i, n + 2)).join('')}</row>`,
  ).join('')
  const larguras = [28, 10, 16, 12, 12, 44, 44, 52]
  const cols = larguras
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('')

  return {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '</cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<cols>${cols}</cols><sheetData>${cabecalho}${corpo}</sheetData></worksheet>`,
  }
}
