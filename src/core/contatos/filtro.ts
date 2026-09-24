import type { Nivel } from '@/core/relacionamento'
import type { EtiquetaDeLead } from '@/server/repos/leads'

export type FiltroDeContatos = {
  etiqueta: EtiquetaDeLead | null
  /** A etiqueta manual. Nome diferente porque as duas famílias somam. */
  marca: string | null
  busca: string
  nivel: Nivel | null
  /** Um segmento salvo (a regra). Soma com os outros, como a etiqueta. */
  segmento?: string | null
}

/**
 * Os parâmetros da tela de Contatos. São os mesmos de antes da barra
 * (`etiqueta`, `marca`, `busca`, `nivel`, `pagina`): link salvo e o CSV
 * continuam valendo. Mudar filtro não leva `pagina`, porque a página 3 de um
 * filtro não é a página 3 de outro.
 */
export function enderecoDosContatos(base: string, filtro: Partial<FiltroDeContatos>): string {
  const parametros = new URLSearchParams()
  if (filtro.etiqueta) parametros.set('etiqueta', filtro.etiqueta)
  if (filtro.marca) parametros.set('marca', filtro.marca)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.nivel) parametros.set('nivel', filtro.nivel)
  if (filtro.segmento) parametros.set('segmento', filtro.segmento)
  const consulta = parametros.toString()
  return consulta ? `${base}?${consulta}` : base
}
