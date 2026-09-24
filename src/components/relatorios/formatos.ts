import { comoDinheiro } from '@/core/crm'

/**
 * Cores e formatos dos gráficos de Análise, fora de `graficos.tsx` porque
 * aquele módulo é de cliente e as páginas (servidor) também montam fatias e
 * escrevem dinheiro curto.
 */

export type Fatia = { chave: string; rotulo: string; n: number; cor: string; dica?: string; alerta?: boolean }

export const CORES_CATEGORICAS = [
  'var(--serie-1)',
  'var(--serie-2)',
  'var(--serie-3)',
  'var(--serie-4)',
  'var(--serie-5)',
  'var(--serie-6)',
]
export const COR_OUTROS = 'var(--serie-outros)'

/** Azul da marca misturado com o fundo: `p` de 0 (fundo) a 100 (azul cheio). */
export function azul(p: number): string {
  return `color-mix(in oklab, var(--primary) ${Math.round(p)}%, var(--surface-strong))`
}

/** R$ 12,4 mil: o valor exato vai na dica. */
export function dinheiroCurto(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (valor >= 10_000) return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return comoDinheiro(valor)
}

/** As seis primeiras categorias com cor própria; o resto soma em "Outros". */
export function emFatias(linhas: { chave: string; rotulo: string; n: number }[], rotuloOutros = 'Outros'): Fatia[] {
  const ordenadas = [...linhas].sort((a, b) => b.n - a.n)
  const cabem = ordenadas.length > 6 ? 5 : 6
  const fatias: Fatia[] = ordenadas.slice(0, cabem).map((l, i) => ({ ...l, cor: CORES_CATEGORICAS[i]! }))
  const resto = ordenadas.slice(cabem)
  if (resto.length > 0) {
    fatias.push({ chave: '__outros', rotulo: `${rotuloOutros} (${resto.length})`, n: resto.reduce((s, l) => s + l.n, 0), cor: COR_OUTROS })
  }
  return fatias
}

