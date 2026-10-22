import type { FiltroDeEscopo } from './permissoes'

/**
 * O seletor Eu / Equipe / Conta da Análise (cobrança camada 2, b).
 *
 * Quem enxerga mais que o próprio escolhe ver menos: o gerente olha os
 * números dele sem a equipe, o dono olha uma equipe. Nunca o contrário: o
 * recorte só estreita o escopo da pessoa, e ninguém chega pelo endereço a
 * um recorte que a função não dá.
 *
 * O padrão é o maior recorte, que é o que a tela mostrava antes do seletor:
 * para quem não mexe, nada muda. A escolha mora no endereço (`?ver=`), como
 * período e funil.
 */

export type Recorte = 'eu' | 'equipe' | 'conta'

export const ROTULO_DO_RECORTE: Record<Recorte, string> = { eu: 'Eu', equipe: 'Equipe', conta: 'Conta' }

/** Os recortes que esta pessoa pode escolher, do menor para o maior. Um só = sem seletor. */
export function recortesPossiveis(
  filtro: FiltroDeEscopo,
  usuarioId: string | null | undefined,
  equipes: readonly string[] | undefined,
): Recorte[] {
  if (filtro.tipo === 'impossivel' || filtro.tipo === 'proprios') return filtro.tipo === 'proprios' ? ['eu'] : []
  const recortes: Recorte[] = usuarioId ? ['eu'] : []
  if ((equipes?.length ?? 0) > 0) recortes.push('equipe')
  if (filtro.tipo === 'tudo') recortes.push('conta')
  return recortes
}

/** O recorte pedido, se ele é possível; senão o maior. */
export function lerRecorte(pedido: string | null | undefined, possiveis: readonly Recorte[]): Recorte | null {
  if (pedido && (possiveis as readonly string[]).includes(pedido)) return pedido as Recorte
  return possiveis[possiveis.length - 1] ?? null
}

/** O escopo da consulta com o recorte aplicado. Só estreita. */
export function filtroDoRecorte(
  filtro: FiltroDeEscopo,
  recorte: Recorte | null,
  usuarioId: string | null | undefined,
  equipes: readonly string[] | undefined,
): FiltroDeEscopo {
  if (recorte === 'eu' && usuarioId && filtro.tipo !== 'impossivel') return { tipo: 'proprios', usuarioId }
  if (recorte === 'equipe' && filtro.tipo === 'tudo' && equipes && equipes.length > 0) return { tipo: 'equipes', equipes }
  return filtro
}
