/**
 * Listas no texto do WhatsApp: lidas na bolha e escritas no campo de resposta.
 *
 * Quem atende não conseguia fazer lista nem numeração: o campo é um
 * `<textarea>`, e Enter manda a mensagem. As regras daqui são as do atalho,
 * e a lista **sai como texto puro**: `•` e `1.` são caracteres, aparecem iguais
 * em qualquer versão do WhatsApp. A lista nativa com `* ` não aparece nas
 * versões antigas, por isso o `* ` digitado vira `• ` na hora.
 *
 * Mora ao lado de `marcacao.ts` pelo mesmo motivo: o campo e a bolha usam a
 * mesma leitura de linha, e duas leituras acabariam discordando.
 */

export type Linha =
  | { tipo: 'item'; simbolo: string; conteudo: string }
  | { tipo: 'citacao'; conteudo: string }
  | { tipo: 'texto'; conteudo: string }

/** Uma troca de trecho no campo: `[inicio, fim)` vira `texto`, cursor no fim dele. */
export type Edicao = { inicio: number; fim: number; texto: string }

const ITEM = /^(?:([•*-]) |(\d{1,3})\. )/

type Item = { marcador: string; numero: number | null; conteudo: string }

function lerItem(linha: string): Item | null {
  const achado = ITEM.exec(linha)
  if (!achado) return null
  return {
    marcador: achado[0],
    numero: achado[2] !== undefined ? Number(achado[2]) : null,
    conteudo: linha.slice(achado[0].length),
  }
}

/** Como a bolha desenha uma linha: item de lista, citação ou texto corrido. */
export function classificarLinha(linha: string): Linha {
  const item = lerItem(linha)
  if (item) {
    return {
      tipo: 'item',
      simbolo: item.numero !== null ? `${item.numero}.` : '•',
      conteudo: item.conteudo,
    }
  }
  if (linha.startsWith('> ')) return { tipo: 'citacao', conteudo: linha.slice(2) }
  return { tipo: 'texto', conteudo: linha }
}

/** Tem alguma linha que não é texto corrido? O caminho comum não paga nada. */
export function temBlocos(texto: string): boolean {
  return texto.split('\n').some((linha) => classificarLinha(linha).tipo !== 'texto')
}

function inicioDaLinha(valor: string, posicao: number): number {
  return posicao === 0 ? 0 : valor.lastIndexOf('\n', posicao - 1) + 1
}

/**
 * Espaço depois de `*` ou `-` no começo da linha: vira `• `.
 *
 * Só no começo da linha e só com o símbolo sozinho, então `*negrito*` e
 * `2 * 3` nunca disparam.
 */
export function marcadorAoDigitarEspaco(valor: string, cursor: number): Edicao | null {
  const inicio = inicioDaLinha(valor, cursor)
  const antes = valor.slice(inicio, cursor)
  if (antes !== '*' && antes !== '-') return null
  return { inicio, fim: cursor, texto: '• ' }
}

/**
 * Enter numa linha de lista.
 *
 * - com conteúdo, abre o próximo item: `• `, ou `3. ` depois de `2. `;
 * - num item vazio, encerra a lista: o marcador some e a linha fica vazia.
 *
 * `null` quando a linha não é de lista, ou o cursor está antes do marcador:
 * aí o Enter faz o que sempre fez.
 */
export function quebraNaLista(valor: string, inicio: number, fim: number): Edicao | null {
  const comeco = inicioDaLinha(valor, inicio)
  const quebra = valor.indexOf('\n', fim)
  const final = quebra === -1 ? valor.length : quebra
  const item = lerItem(valor.slice(comeco, final))
  if (!item || inicio < comeco + item.marcador.length) return null

  if (item.conteudo.trim() === '' && inicio === fim) {
    return { inicio: comeco, fim: final, texto: '' }
  }
  const proximo = item.numero !== null ? `${item.numero + 1}. ` : '• '
  return { inicio, fim, texto: `\n${proximo}` }
}
