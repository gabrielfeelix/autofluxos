/**
 * CSV para abrir no Excel e no Google Sheets sem susto.
 *
 * Duas armadilhas moram aqui, e as duas são silenciosas:
 *
 * 1. **Injeção de fórmula.** Uma célula começando com `=`, `+`, `-` ou `@` é
 *    executada como fórmula ao abrir a planilha. O conteúdo vem do WhatsApp de
 *    estranhos — `=HYPERLINK(...)` num campo de nome vira link clicável na
 *    planilha de quem exportou, e há famílias inteiras de ataque em cima disso.
 *    Aspas não resolvem: o Excel avalia depois de tirar as aspas. O que resolve
 *    é uma aspa simples na frente, que a planilha entende como "isto é texto".
 * 2. **Quebra de linha e ponto e vírgula dentro do campo.** Sem aspas, uma
 *    mensagem com `\n` vira duas linhas e o arquivo inteiro desalinha.
 *
 * Por isso toda célula sai entre aspas, sempre — arquivo previsível vale mais
 * do que arquivo curto.
 */

/** Caracteres que fazem a planilha tratar a célula como fórmula. */
const COMECO_DE_FORMULA = /^[=+\-@\t\r]/

export function celulaCsv(valor: string | null | undefined): string {
  const texto = valor ?? ''
  const seguro = COMECO_DE_FORMULA.test(texto) ? `'${texto}` : texto
  return `"${seguro.replaceAll('"', '""')}"`
}

/**
 * Monta o arquivo.
 *
 * O `\uFEFF` na frente é o BOM. Sem ele, o Excel do Windows lê o arquivo como
 * latin-1 e todo acento vira lixo — e o nome das pessoas é justamente onde os
 * acentos estão. O `\r\n` é o que o RFC 4180 pede.
 */
export function montarCsv(cabecalhos: string[], linhas: (string | null | undefined)[][]): string {
  const conteudo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(celulaCsv).join(','))
    .join('\r\n')

  return `\uFEFF${conteudo}\r\n`
}

/**
 * Um nome de arquivo que o navegador aceita e a pessoa reconhece.
 *
 * O nome do cliente entra porque quem exporta três clientes numa tarde acaba
 * com três `leads.csv` na pasta de downloads e não sabe qual é qual.
 */
export function nomeDoArquivo(prefixo: string, cliente: string, dia: string): string {
  const limpo = cliente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)

  return `${prefixo}-${limpo || 'cliente'}-${dia}.csv`
}
