import type { FiltroDeEstado, Lead } from '@/server/repos/leads'

/**
 * A conversa cabe no filtro de estado e de dono escolhido na fila?
 *
 * Sem `'use client'` de propósito: a página no servidor e a fila viva no
 * navegador perguntam a mesma coisa, e função de módulo de cliente chega ao
 * servidor como referência, não como função.
 */
export function cabeNoRecorte(lead: Lead, estado: FiltroDeEstado, atribuicao: string): boolean {
  if (estado !== 'todas' && lead.estadoEfetivo !== estado) return false
  if (atribuicao === 'todos') return true
  if (atribuicao === 'sem-dono') return lead.atribuidoA === null
  return lead.atribuidoA === atribuicao
}

/**
 * A conversa cabe no filtro de setor (0157)?
 *
 * `meus` é o padrão de quem é de algum setor: as filas dos setores dela, a
 * fila geral e o que já é dela, mesmo vindo de outro setor. Esconder a fila
 * geral deixaria sem ninguém a conversa que ainda não escolheu assunto.
 */
export function cabeNoSetor(
  lead: Lead,
  setor: string,
  meusSetores: readonly string[],
  usuarioId: string | null,
): boolean {
  if (setor === 'todos') return true
  if (setor === 'sem-setor') return lead.setorId === null
  if (setor === 'meus') {
    return (
      lead.setorId === null ||
      meusSetores.includes(lead.setorId) ||
      (usuarioId !== null && lead.atribuidoA === usuarioId)
    )
  }
  return lead.setorId === setor
}
