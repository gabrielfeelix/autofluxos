/**
 * Os emojis do painel, todos, em português.
 *
 * Vêm do `emojibase-data` (MIT) pelo `scripts/gerar-emojis.mjs`, que corta o
 * que a Noto Color Emoji ainda não desenha e junta nome e palavras-chave num
 * texto só para a busca. A lista curada de antes tinha uns 200 emojis, e parte
 * deles sem o seletor de variação: o navegador desenhava esses na fonte de
 * texto, com outro traço e outra proporção no meio da grade.
 *
 * O JSON (~40 KB comprimido) entra por `import()` só quando o painel abre:
 * quem nunca clica no emoji não paga por ele.
 */

export type CategoriaDeEmoji = {
  chave: string
  nome: string
  /** `[emoji, "nome e palavras-chave"]`. */
  itens: [string, string][]
}

export async function carregarEmojis(): Promise<CategoriaDeEmoji[]> {
  const modulo = await import('./emojis-completos.json')
  return modulo.default as CategoriaDeEmoji[]
}

/**
 * Os emojis que casam com o que foi digitado, em todas as categorias.
 *
 * Por **prefixo de palavra**, e não por trecho solto: "car" acha "carro" e
 * "cartão", e não acha "mascara". Sem acento nem maiúscula dos dois lados,
 * quem digita rápido não acentua.
 */
export function buscarEmojis(categorias: CategoriaDeEmoji[], termo: string, teto = 120): string[] {
  const alvos = semAcento(termo).split(/\s+/).filter(Boolean)
  if (alvos.length === 0) return []

  const achados: string[] = []
  for (const categoria of categorias) {
    for (const [emoji, texto] of categoria.itens) {
      const palavras = semAcento(texto).split(/\s+/)
      if (alvos.every((alvo) => palavras.some((palavra) => palavra.startsWith(alvo)))) {
        achados.push(emoji)
        if (achados.length >= teto) return achados
      }
    }
  }
  return achados
}

const CHAVE_DOS_RECENTES = 'af:emojis-recentes'
const QUANTOS_RECENTES = 18

/** Os últimos escolhidos, deste navegador. Sem armazenamento, lista vazia. */
export function lerRecentes(): string[] {
  try {
    const lido = JSON.parse(localStorage.getItem(CHAVE_DOS_RECENTES) ?? '[]')
    return Array.isArray(lido) ? lido.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** Põe o emoji na frente dos recentes e devolve a lista nova. */
export function guardarRecente(emoji: string): string[] {
  const lista = [emoji, ...lerRecentes().filter((item) => item !== emoji)].slice(0, QUANTOS_RECENTES)
  try {
    localStorage.setItem(CHAVE_DOS_RECENTES, JSON.stringify(lista))
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): só não lembra.
  }
  return lista
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
