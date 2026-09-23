/**
 * Planilha em linhas de texto: CSV e o miolo do `.xlsx`.
 *
 * Puro e sem rede. Quem descompacta o `.xlsx` (é um zip) é o servidor, e
 * entrega aqui os XML já como texto. Separar assim deixa a parte que erra
 * calada (coluna trocada, número virando notação científica, linha contada
 * errado) testável sem arquivo nenhum.
 *
 * Cada linha sai com o **número da linha na planilha**, e não o índice no
 * array: o erro da importação diz "linha 7", e a pessoa abre o Excel e vai na
 * linha 7. Pular linha vazia sem guardar o número faria o erro apontar para a
 * linha errada.
 */

export type Linha = { linha: number; celulas: string[] }

function ehVazia(celulas: string[]): boolean {
  return celulas.every((c) => c.trim() === '')
}

/**
 * O separador é o que aparece mais no arquivo, fora de aspas. O arquivo
 * inteiro e não só o cabeçalho: planilha de uma coluna não tem separador na
 * primeira linha.
 *
 * O Excel em português salva CSV com ponto e vírgula, o Google Planilhas com
 * vírgula. Perguntar para a pessoa qual é seria pedir uma coisa que ela não
 * sabe responder.
 */
function separadorDe(texto: string): ',' | ';' {
  let virgulas = 0
  let pontos = 0
  let dentro = false
  for (const c of texto) {
    if (c === '"') dentro = !dentro
    else if (!dentro && c === ',') virgulas++
    else if (!dentro && c === ';') pontos++
  }
  return pontos >= virgulas && pontos > 0 ? ';' : ','
}

/** CSV no formato da RFC 4180: aspas, aspas dobradas e quebra de linha dentro de aspas. */
export function lerCsv(bruto: string): Linha[] {
  const texto = bruto.replace(/^\uFEFF/, '')
  const sep = separadorDe(texto)
  const linhas: Linha[] = []
  let celulas: string[] = []
  let celula = ''
  let dentro = false
  let numero = 1

  const fecharLinha = () => {
    celulas.push(celula)
    if (!ehVazia(celulas)) linhas.push({ linha: numero, celulas })
    celulas = []
    celula = ''
    numero++
  }

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') {
        celula += '"'
        i++
      } else if (c === '"') {
        dentro = false
      } else {
        celula += c
      }
    } else if (c === '"') {
      dentro = true
    } else if (c === sep) {
      celulas.push(celula)
      celula = ''
    } else if (c === '\n') {
      fecharLinha()
    } else if (c !== '\r') {
      celula += c
    }
  }
  if (celula !== '' || celulas.length > 0) fecharLinha()

  return linhas
}

function decodificarXml(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Todo o texto dos `<t>` de um trecho, na ordem. Texto rico vem em vários. */
function textoDosT(trecho: string): string {
  let saida = ''
  for (const m of trecho.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) saida += m[1]
  return decodificarXml(saida)
}

/** "C" vira 2, "AA" vira 26. */
function indiceDaColuna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64)
  return n - 1
}

/**
 * O número como a pessoa digitou, na medida do possível.
 *
 * O `.xlsx` guarda `10.2` como `10.199999999999999` e um código de barras como
 * `7.891234567890E12`. Sem este conserto o preço falha na conferência por ter
 * decimal demais, e o SKU vira outro texto.
 */
function numeroComoTexto(bruto: string): string {
  const n = Number(bruto)
  if (!Number.isFinite(n)) return bruto
  if (Number.isInteger(n)) return BigInt(Math.round(n)).toString()
  const decimais = /\.(\d+)/.exec(bruto)?.[1]?.length ?? 0
  return decimais > 2 && !/e/i.test(bruto) ? n.toFixed(2) : String(n)
}

/**
 * A primeira aba de um `.xlsx`, a partir dos XML de dentro do zip.
 *
 * `arquivos` é caminho dentro do zip para o texto do arquivo. A primeira aba
 * é a primeira do `workbook.xml`, e não o `sheet1.xml`: quem reordena as abas
 * no Excel muda a ordem sem renomear o arquivo.
 */
export function lerXlsx(arquivos: Record<string, string>): Linha[] {
  const workbook = arquivos['xl/workbook.xml']
  if (!workbook) throw new Error('esse arquivo não parece uma planilha do Excel (.xlsx)')

  let caminho = 'xl/worksheets/sheet1.xml'
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1]
  const rels = arquivos['xl/_rels/workbook.xml.rels']
  if (rid && rels) {
    const rel = new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`).exec(rels)?.[0]
    const alvo = rel && /\bTarget="([^"]+)"/.exec(rel)?.[1]
    if (alvo) caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`
  }
  const aba = arquivos[caminho]
  if (!aba) throw new Error('não achei a primeira aba da planilha')

  const compartilhadas = [...(arquivos['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => textoDosT(m[1] ?? ''),
  )

  const linhas: Linha[] = []
  for (const row of aba.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(/\br="(\d+)"/.exec(row[1] ?? '')?.[1] ?? linhas.length + 1)
    const celulas: string[] = []
    for (const c of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = c[1] ?? ''
      const corpo = c[2] ?? ''
      const ref = /\br="([A-Z]+)\d*"/.exec(atributos)?.[1]
      const indice = ref ? indiceDaColuna(ref) : celulas.length
      const tipo = /\bt="([^"]+)"/.exec(atributos)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1]

      let valor = ''
      if (tipo === 's') valor = compartilhadas[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoDosT(corpo)
      else if (tipo === 'str' || tipo === 'b' || tipo === 'e') valor = decodificarXml(v ?? '')
      else if (v !== undefined) valor = numeroComoTexto(v)

      while (celulas.length < indice) celulas.push('')
      celulas[indice] = valor
    }
    if (!ehVazia(celulas)) linhas.push({ linha: numero, celulas })
  }
  return linhas
}
