'use client'

import { useRef, type ReactNode } from 'react'

/**
 * A rolagem da tabela de contatos, que marca `data-rolada` quando saiu da
 * esquerda.
 *
 * É o que acende a divisória das colunas fixas: com a tabela parada no começo,
 * nada passa por baixo delas e a linha vertical só pesava na tela. O atributo
 * vai direto no elemento, sem estado do React: rolar não pode re-renderizar
 * cinquenta linhas a cada pixel.
 */
export function RolagemDaTabela({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={caixa}
      onScroll={(evento) => {
        const rolada = evento.currentTarget.scrollLeft > 0
        if ((evento.currentTarget.dataset.rolada === 'sim') !== rolada) {
          evento.currentTarget.dataset.rolada = rolada ? 'sim' : 'nao'
        }
      }}
      data-rolada="nao"
      // `relative` prende o `sr-only` do cabeçalho de Ações (que é `absolute`)
      // dentro da rolagem; sem ele, o texto invisível esticava a página no celular.
      className="group/rolagem relative min-h-0 flex-1 overflow-auto"
    >
      {children}
    </div>
  )
}
