'use client'

import {
  createContext,
  createElement,
  startTransition,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

/**
 * O que esta aba acabou de mudar numa conversa, antes de o servidor confirmar.
 *
 * ---------------------------------------------------------------------------
 * Por que existe
 * ---------------------------------------------------------------------------
 *
 * Resolver, pausar o bot, assumir, marcar etiqueta: cada gesto do Inbox
 * aparece em três ou quatro lugares ao mesmo tempo (o botão do cabeçalho, o
 * selo embaixo do nome, o cartão da coluna do contato, a linha da fila). Cada
 * um guardava a própria cópia otimista, ou nenhuma, e quem juntava tudo era o
 * `revalidatePath` da ação, que redesenhava a página inteira segundos depois.
 *
 * O `revalidatePath` saiu das ações de gesto (medido em 25/set: no Next 16.3,
 * **qualquer** `revalidatePath` dentro de Server Action redesenha a página
 * aberta, mesmo com o caminho de outra tela; ver `revalidate.js`, "TODO: only
 * revalidate if the path matches"). Sem ele, alguém precisa dizer aos quatro
 * lugares o que mudou. É este store, no molde de `conta/presenca.ts`.
 *
 * ---------------------------------------------------------------------------
 * Quando o remendo deixa de valer
 * ---------------------------------------------------------------------------
 *
 * Cada remendo guarda o valor que o servidor mostrava quando o gesto
 * aconteceu (`base`). Enquanto a tela recebe esse mesmo valor do servidor, o
 * remendo vale: é o caso de voltar a uma conversa pelo cache do roteador
 * (`staleTimes.dynamic`), que traz a página de antes do gesto. Quando o
 * servidor manda outra coisa, ele já sabe, e manda ele.
 */

export type Conversa = {
  estado: 'aberta' | 'adiada' | 'resolvida'
  automacaoAtiva: boolean
  atribuidoA: string | null
  sessaoComPessoa: boolean
  aguardando: { motivo: string; desde: string } | null
  /** Ids das etiquetas manuais aplicadas. */
  etiquetas: string[]
}

type Remendo = { valores: Partial<Conversa>; base: Partial<Conversa> }

let remendos: ReadonlyMap<string, Remendo> = new Map()
const assinantes = new Set<() => void>()

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

function trocar(contatoId: string, remendo: Remendo | null) {
  const novo = new Map(remendos)
  if (remendo && Object.keys(remendo.valores).length > 0) novo.set(contatoId, remendo)
  else novo.delete(contatoId)
  remendos = novo
  assinantes.forEach((assinante) => assinante())
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** O valor do servidor com o que esta aba mudou por cima. */
export function comRemendo<T extends Partial<Conversa>>(
  remendo: Remendo | undefined,
  doServidor: T,
): T {
  if (!remendo) return doServidor
  const saida = { ...doServidor }
  for (const chave of Object.keys(remendo.valores) as (keyof Conversa)[]) {
    if (!(chave in doServidor)) continue
    if (igual(doServidor[chave], remendo.base[chave])) {
      ;(saida as Partial<Conversa>)[chave] = remendo.valores[chave] as never
    }
  }
  return saida
}

/** Todos os remendos, para quem desenha muitas conversas (a fila). */
export function useRemendos(): ReadonlyMap<string, Remendo> {
  return useSyncExternalStore(
    assinar,
    () => remendos,
    () => remendos,
  )
}

/** Uma conversa como a tela deve mostrar agora. */
export function useConversa<T extends Partial<Conversa>>(contatoId: string, doServidor: T): T {
  const remendo = useSyncExternalStore(
    assinar,
    () => remendos.get(contatoId),
    () => undefined,
  )
  return comRemendo(remendo, doServidor)
}

/**
 * Põe a mudança na tela agora e devolve quem desfaz.
 *
 * `doServidor` é o que a tela recebeu do servidor: vira a `base` do remendo.
 * Desfazer devolve só as chaves desta mudança, porque outro gesto pode ter
 * mexido noutra chave da mesma conversa no meio do caminho.
 */
export function mudarConversa(
  contatoId: string,
  doServidor: Partial<Conversa>,
  mudanca: Partial<Conversa>,
): () => void {
  const antes = remendos.get(contatoId)
  const valores = { ...antes?.valores, ...mudanca }
  const base = { ...antes?.base }
  for (const chave of Object.keys(mudanca) as (keyof Conversa)[]) {
    ;(base as Record<string, unknown>)[chave] = doServidor[chave]
  }
  trocar(contatoId, { valores, base })

  return () => {
    const agora = remendos.get(contatoId)
    if (!agora) return
    const v = { ...agora.valores } as Record<string, unknown>
    const b = { ...agora.base } as Record<string, unknown>
    for (const chave of Object.keys(mudanca) as (keyof Conversa)[]) {
      if (antes && chave in antes.valores) {
        v[chave] = antes.valores[chave]
        b[chave] = antes.base[chave]
      } else {
        delete v[chave]
        delete b[chave]
      }
    }
    trocar(contatoId, { valores: v as Partial<Conversa>, base: b as Partial<Conversa> })
  }
}

export type Resposta = { ok?: boolean; erro?: string } | void | undefined

/**
 * O gesto inteiro: muda já, grava por trás, desfaz se o servidor recusar.
 * Devolve a frase do erro, ou `null` quando deu certo.
 */
export async function agirNaConversa(
  contatoId: string,
  doServidor: Partial<Conversa>,
  mudanca: Partial<Conversa>,
  acao: () => Promise<Resposta>,
): Promise<string | null> {
  const desfazer = mudarConversa(contatoId, doServidor, mudanca)
  return depoisDaTela(acao).then(
    (r) => {
      if (r && (r.erro || r.ok === false)) {
        desfazer()
        return r.erro ?? 'não deu para salvar'
      }
      return null
    },
    () => {
      desfazer()
      return 'sem conexão com o servidor'
    },
  )
}

/**
 * Chama a Server Action **numa transição**.
 *
 * Fora dela, o roteador do Next registra a ação com prioridade síncrona, no
 * mesmo quadro da mudança otimista, e redesenha o layout inteiro antes de a
 * tela mostrar o clique (medido em 25/set: o botão levava 100 a 300 ms em
 * vez de 10). Dentro da transição a tela muda primeiro.
 */
export function depoisDaTela<T>(acao: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    startTransition(async () => {
      try {
        resolve(await acao())
      } catch (erro) {
        reject(erro)
      }
    })
  })
}

// ---------------------------------------------------------------------------
// A conversa aberta
// ---------------------------------------------------------------------------

/**
 * O que o servidor desenhou da conversa aberta, para quem está dentro dela.
 *
 * Cabeçalho, caixa de resposta e coluna do contato são irmãos na página, e
 * todos precisam do mesmo `doServidor` para o remendo saber quando parar de
 * valer. O provedor evita passar isso à mão por quatro camadas.
 */
type Aberta = {
  contatoId: string
  doServidor: Conversa
  usuarioId: string | null
  /** Para recalcular o estado do atendimento (`core/estado-do-atendimento.ts`). */
  temAutomacao: boolean
  /** Para dar nome a quem ficou com a conversa depois de assumir ou passar. */
  equipe: { id: string; nome: string }[]
}
const ContextoDaAberta = createContext<Aberta | null>(null)

export function ProvedorDaConversa({
  children,
  ...aberta
}: Aberta & { children: ReactNode }) {
  return createElement(ContextoDaAberta.Provider, { value: aberta }, children)
}

/** A conversa aberta, já com o que esta aba mudou, e o jeito de mudar mais. */
export function useConversaAberta() {
  const aberta = useContext(ContextoDaAberta)
  if (!aberta) throw new Error('useConversaAberta fora de ProvedorDaConversa')
  const valor = useConversa(aberta.contatoId, aberta.doServidor)
  return {
    ...aberta,
    valor,
    agir: (mudanca: Partial<Conversa>, acao: () => Promise<Resposta>) =>
      agirNaConversa(aberta.contatoId, aberta.doServidor, mudanca, acao),
    mudar: (mudanca: Partial<Conversa>) =>
      mudarConversa(aberta.contatoId, aberta.doServidor, mudanca),
  }
}

/** Igual a `useConversaAberta`, mas `null` fora do provedor (a Ficha). */
export function useConversaAbertaOuNada() {
  const aberta = useContext(ContextoDaAberta)
  const valor = useConversa(aberta?.contatoId ?? '', aberta?.doServidor ?? {})
  return aberta
    ? {
        ...aberta,
        valor: valor as Conversa,
        mudar: (mudanca: Partial<Conversa>) =>
          mudarConversa(aberta.contatoId, aberta.doServidor, mudanca),
      }
    : null
}

// ---------------------------------------------------------------------------
// A fila
// ---------------------------------------------------------------------------

type LinhaDaFila = {
  contatoId: string
  estadoEfetivo: Conversa['estado']
  automacaoAtiva: boolean
  atribuidoA: string | null
  aguardando: Conversa['aguardando']
}

/**
 * Uma linha da fila com o que esta aba mudou por cima.
 *
 * Aplicado **antes** de filtrar: resolver uma conversa com o filtro em
 * "Abertas" tira a linha da lista no clique, como o redesenho do servidor
 * fazia segundos depois.
 */
export function linhaViva<T extends LinhaDaFila>(lead: T, todos: ReadonlyMap<string, Remendo>): T {
  const remendo = todos.get(lead.contatoId)
  if (!remendo) return lead
  const v = comRemendo(remendo, {
    estado: lead.estadoEfetivo,
    automacaoAtiva: lead.automacaoAtiva,
    atribuidoA: lead.atribuidoA,
    aguardando: lead.aguardando,
  })
  return {
    ...lead,
    estadoEfetivo: v.estado,
    automacaoAtiva: v.automacaoAtiva,
    atribuidoA: v.atribuidoA,
    aguardando: v.aguardando,
  }
}
