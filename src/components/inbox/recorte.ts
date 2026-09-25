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
