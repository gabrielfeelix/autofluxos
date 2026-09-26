/**
 * Produtos no atendimento: o que foi oferecido por card e o que foi aberto.
 *
 * Duas fontes, as duas já gravadas pelo envio e pelo clique:
 *
 * - **card enviado**: `messages.payload.produtos` (uma linha por mensagem,
 *   um item por card), com quem mandou em `payload.autor` (ver
 *   `core/autor-da-mensagem.ts`): `automacao` é o robô, `pessoa` é quem
 *   atende pelo Inbox;
 * - **clique em "Ver produto"**: evento `abriu-produto` em
 *   `eventos_do_contato`, com o nome do produto e o link de destino. O link
 *   carrega as UTMs de `server/link-de-produto.ts`: `utm_medium` diz robô
 *   (`chatbot`) ou pessoa (`atendimento`) e `utm_content` diz quem
 *   (`robo` ou `nome-<8 primeiros do id>`).
 *
 * O banco devolve as linhas já agrupadas; aqui só se soma, separa e ordena,
 * para a regra ser testável sem banco.
 */

/** Cliques agrupados por produto e link, como o banco devolve. */
export type CliquesDoLink = { produto: string | null; link: string | null; n: number }

/** Cards enviados agrupados por autor, como o banco devolve. */
export type EnviosDoAutor = {
  /** `null` = mensagem sem autor gravado. */
  tipo: string | null
  usuarioId: string | null
  nome: string | null
  cards: number
}

export type OrigemDoClique = { meio: 'robo' | 'pessoa' | null; quem: string | null }

export type ProdutoClicado = {
  nome: string
  cliques: number
  doRobo: number
  dePessoas: number
  /** Link sem UTM (gravado antes delas) ou com UTM de outro lugar. */
  semOrigem: number
}

export type QuemOfereceu = {
  chave: string
  nome: string
  robo: boolean
  cards: number
  /** Cliques nos cards desta origem, no período. */
  cliques: number
}

export type ProdutosNoAtendimento = {
  produtos: ProdutoClicado[]
  quem: QuemOfereceu[]
  cardsDoRobo: number
  cardsDePessoas: number
  cliques: number
}

export const SEM_NOME_DO_PRODUTO = 'Produto sem nome'
export const PESSOA_SEM_NOME = 'Atendente sem nome registrado'

/** Quem mandou o card que foi clicado, pelas UTMs do link. */
export function origemDoClique(link: string | null): OrigemDoClique {
  if (!link) return { meio: null, quem: null }
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return { meio: null, quem: null }
  }
  const meio = url.searchParams.get('utm_medium')
  const quem = url.searchParams.get('utm_content')
  if (meio === 'chatbot') return { meio: 'robo', quem: 'robo' }
  if (meio === 'atendimento') return { meio: 'pessoa', quem: quem || null }
  return { meio: null, quem: null }
}

/** O pedaço do id que `quemNaUtm` põe no fim do `utm_content`. */
function sufixoDoId(usuarioId: string): string {
  return usuarioId.replace(/-/g, '').slice(0, 8).toLowerCase()
}

function sufixoDaUtm(quem: string): string | null {
  const m = /-([0-9a-f]{8})$/i.exec(quem)
  return m ? m[1]!.toLowerCase() : null
}

export function resumirProdutosNoAtendimento(cliques: CliquesDoLink[], envios: EnviosDoAutor[]): ProdutosNoAtendimento {
  // Cliques, por produto e por quem mandou o card.
  const porProduto = new Map<string, ProdutoClicado>()
  const cliquesPorSufixo = new Map<string, number>()
  let cliquesDoRobo = 0
  let total = 0
  for (const c of cliques) {
    if (c.n <= 0) continue
    const nome = c.produto?.trim() || SEM_NOME_DO_PRODUTO
    const linha = porProduto.get(nome) ?? { nome, cliques: 0, doRobo: 0, dePessoas: 0, semOrigem: 0 }
    const origem = origemDoClique(c.link)
    linha.cliques += c.n
    if (origem.meio === 'robo') {
      linha.doRobo += c.n
      cliquesDoRobo += c.n
    } else if (origem.meio === 'pessoa') {
      linha.dePessoas += c.n
      const sufixo = origem.quem ? sufixoDaUtm(origem.quem) : null
      if (sufixo) cliquesPorSufixo.set(sufixo, (cliquesPorSufixo.get(sufixo) ?? 0) + c.n)
    } else {
      linha.semOrigem += c.n
    }
    porProduto.set(nome, linha)
    total += c.n
  }

  // Envios, por autor. A mesma pessoa pode vir em mais de uma linha (trocou o
  // nome no meio do período): o id junta, e o primeiro nome visto fica.
  const porAutor = new Map<string, QuemOfereceu>()
  let cardsDoRobo = 0
  let cardsDePessoas = 0
  for (const e of envios) {
    if (e.cards <= 0) continue
    if (e.tipo === 'automacao') {
      cardsDoRobo += e.cards
      continue
    }
    cardsDePessoas += e.cards
    const nome = e.nome?.trim() || PESSOA_SEM_NOME
    const chave = e.usuarioId ? `u:${e.usuarioId}` : `n:${nome}`
    const linha = porAutor.get(chave) ?? {
      chave,
      nome,
      robo: false,
      cards: 0,
      cliques: e.usuarioId ? (cliquesPorSufixo.get(sufixoDoId(e.usuarioId)) ?? 0) : 0,
    }
    linha.cards += e.cards
    porAutor.set(chave, linha)
  }

  const pessoas = [...porAutor.values()].sort(
    (a, b) => b.cards - a.cards || b.cliques - a.cliques || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
  const quem: QuemOfereceu[] =
    cardsDoRobo > 0 || cliquesDoRobo > 0
      ? [{ chave: 'robo', nome: 'Robô', robo: true, cards: cardsDoRobo, cliques: cliquesDoRobo }, ...pessoas]
      : pessoas

  return {
    produtos: [...porProduto.values()].sort((a, b) => b.cliques - a.cliques || a.nome.localeCompare(b.nome, 'pt-BR')),
    quem,
    cardsDoRobo,
    cardsDePessoas,
    cliques: total,
  }
}
