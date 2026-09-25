'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * O quanto os gestos desta aba mexeram nos números do menu lateral.
 *
 * "Minhas", "sem responsável" e "atrasadas" são contados no servidor, no
 * layout. Quem os atualizava depois de assumir uma conversa ou concluir uma
 * atividade era o `revalidatePath` da ação, que redesenhava a página inteira.
 * Ele saiu dos gestos (ver `gestoSemRecarregar`), e o número passaria a mentir
 * até o próximo carregamento. Aqui cada gesto soma ou subtrai na hora.
 *
 * O ajuste vale sobre o número que o servidor mostrava quando ele começou
 * (`base`). Quando o servidor manda outro número, ele já contou o gesto, e o
 * ajuste é esquecido.
 */

export type Contagem = 'minhas' | 'sem-dono' | 'atrasadas'

type Ajuste = { base: number | undefined; delta: number }

let ajustes: Readonly<Partial<Record<Contagem, Ajuste>>> = {}
/** O último número do servidor que a tela desenhou, por contagem. */
const vistos: Partial<Record<Contagem, number>> = {}
const assinantes = new Set<() => void>()

function assinar(assinante: () => void) {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}

/** Soma `delta` a uma contagem do menu. Negativo tira. */
export function ajustarContagem(qual: Contagem, delta: number) {
  if (delta === 0) return
  const atual = ajustes[qual]
  const base = vistos[qual]
  ajustes = {
    ...ajustes,
    [qual]: atual && atual.base === base ? { base, delta: atual.delta + delta } : { base, delta },
  }
  assinantes.forEach((assinante) => assinante())
}

/** O número como a tela deve mostrar: o do servidor, mais o que esta aba mexeu. */
export function useContagem(qual: Contagem, doServidor: number): number {
  const agora = useSyncExternalStore(
    assinar,
    () => ajustes,
    () => ajustes,
  )
  useEffect(() => {
    vistos[qual] = doServidor
  }, [qual, doServidor])
  const ajuste = agora[qual]
  if (!ajuste || ajuste.base !== doServidor) return doServidor
  return Math.max(0, doServidor + ajuste.delta)
}

// ---------------------------------------------------------------------------
// O que cada gesto conta
// ---------------------------------------------------------------------------

type ConversaContada = { estado: string; atribuidoA: string | null }

/**
 * Quanto uma conversa pesa em "minhas" e "sem responsável": aberta e comigo,
 * ou aberta e sem dono. A mesma regra de `contarConversasDaBarra`.
 */
export function contarConversa(
  antes: ConversaContada,
  depois: ConversaContada,
  usuarioId: string | null,
): () => void {
  const peso = (c: ConversaContada) => ({
    minhas: c.estado === 'aberta' && usuarioId !== null && c.atribuidoA === usuarioId ? 1 : 0,
    semDono: c.estado === 'aberta' && c.atribuidoA === null ? 1 : 0,
  })
  const a = peso(antes)
  const d = peso(depois)
  ajustarContagem('minhas', d.minhas - a.minhas)
  ajustarContagem('sem-dono', d.semDono - a.semDono)
  return () => {
    ajustarContagem('minhas', a.minhas - d.minhas)
    ajustarContagem('sem-dono', a.semDono - d.semDono)
  }
}

/**
 * Atrasada, para o menu: aberta e com prazo antes de hoje. A mesma regra de
 * `contagensDaAgenda` (`vencidas`).
 */
export function atrasada(atividade: { situacao: string; prazo: string | null }): boolean {
  if (atividade.situacao !== 'aberta' || !atividade.prazo) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Date.parse(atividade.prazo) < hoje.getTime()
}
