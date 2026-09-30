/**
 * As iniciais de um nome, para avatar e cartão sem foto.
 *
 * ---------------------------------------------------------------------------
 * Por que existe (30/set/2026)
 * ---------------------------------------------------------------------------
 *
 * Nome de WhatsApp vem com letra "estilizada": `𝒟𝑜𝓊𝑔𝓁𝒶𝓈`, `~𝓛𝓮𝓸𝓷𝓪𝓻𝓭𝓸`. Essas
 * letras moram fora do plano básico do Unicode e ocupam **duas** unidades de
 * texto no JavaScript. Pegar `nome[0]` cortava a letra ao meio, e o avatar
 * desenhava `��`. O til de enfeite virava a inicial do Leonardo.
 *
 * Três cuidados, nesta ordem:
 * 1. `NFKC` transforma a letra estilizada na letra comum (`𝒟` vira `D`);
 * 2. a inicial é a primeira **letra ou número** da palavra, pulando enfeite
 *    (`~`, `*`, `.`);
 * 3. o corte é por caractere inteiro (`Array.from`), nunca por unidade de
 *    texto, então nada sai partido ao meio.
 *
 * Nome sem letra nenhuma (só emoji, `😎`) fica com o primeiro emoji, que é o
 * que a pessoa escolheu para se apresentar.
 */
export function iniciais(nome: string | null | undefined, opcoes: { palavraUnica?: 1 | 2 } = {}): string {
  const limpo = (nome ?? '').normalize('NFKC').trim()
  if (limpo === '') return '?'

  const palavras = limpo
    .split(/\s+/)
    .map((palavra) => Array.from(palavra).filter((c) => /[\p{L}\p{N}]/u.test(c)))
    .filter((letras) => letras.length > 0)

  if (palavras.length === 0) return primeiroSimbolo(limpo)
  if (palavras.length === 1) return palavras[0]!.slice(0, opcoes.palavraUnica ?? 1).join('').toUpperCase()
  return (palavras[0]![0]! + palavras[palavras.length - 1]![0]!).toUpperCase()
}

function primeiroSimbolo(texto: string): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const [primeiro] = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(texto)
    if (primeiro) return primeiro.segment
  }
  return Array.from(texto)[0] ?? '?'
}
