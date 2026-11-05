/**
 * A base de conhecimento da IA (0168, docs/BASE-DE-CONHECIMENTO.md): o texto
 * que vai para a busca e a consulta que sai para o banco.
 *
 * Puro, sem banco. A busca é a de texto do Postgres em português, sem a
 * extensão `unaccent` (global no projeto dividido com a Verandi): por isso o
 * acento sai aqui, dos dois lados. Quem grava guarda `paraBusca(texto)` em
 * `busca`; quem pesquisa manda `consultaDe(termos)`.
 */

/** Minúsculas, sem acento, só letra, número e espaço. "Híbrido, 2029!" vira "hibrido 2029". */
export function paraBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Palavras que só atrapalham a busca por OU: aparecem em todo trecho. */
const VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'pra', 'por',
  'com', 'que', 'qual', 'quais', 'como', 'se', 'ao', 'aos', 'eu', 'voce', 'vc', 'me', 'meu', 'minha', 'isso', 'esse', 'essa',
  'manual', 'material', 'fala', 'sobre', 'tem', 'ter', 'ou', 'mais', 'muito', 'sim', 'nao',
])

export const MAX_PALAVRAS_DA_CONSULTA = 10

/**
 * A consulta do `to_tsquery`: as palavras dos termos unidas por OU (`|`).
 *
 * OU, e não E: o modelo manda "bateria hibrido autonomia apagao" e o trecho
 * certo nem sempre tem as quatro; o `ts_rank_cd` põe na frente o que tem mais.
 * Só [a-z0-9], então nada do que o modelo escreve vira operador da busca.
 * Vazia quando não sobra palavra: aí não há o que pesquisar.
 */
export function consultaDe(termos: string): string {
  const palavras = paraBusca(termos)
    .split(' ')
    .filter((p) => p !== '' && !VAZIAS.has(p) && (p.length > 1 || /\d/.test(p) || p === 'b' || p === 'a'))
  return [...new Set(palavras)].slice(0, MAX_PALAVRAS_DA_CONSULTA).join(' | ')
}

/**
 * Desfaz o texto "e s p a ç a d o" que alguns PDFs devolvem: letras separadas
 * por um espaço e palavras por dois. Linha comum passa sem mudança.
 */
export function desespacar(linha: string): string {
  const pedacos = linha.trim().split(' ').filter(Boolean)
  if (pedacos.length < 6) return linha
  const soltas = pedacos.filter((p) => [...p].length === 1).length
  if (soltas / pedacos.length < 0.6) return linha
  return linha
    .split(/ {2,}/)
    .map((palavra) => palavra.replace(/ /g, ''))
    .join(' ')
    .trim()
}
