'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ehEditorDeFluxo } from './aba-do-caminho'

/**
 * A casca das telas da conta: barra à esquerda, miolo à direita.
 *
 * Mora no `layout.tsx`, então o Next a mantém montada entre as páginas. O único
 * caso sem barra é o editor de fluxo, que é tela cheia por natureza, e layout no
 * Next não se desliga num filho: por isso a decisão é aqui, pelo caminho, num
 * componente de cliente.
 */
export function MolduraDoCliente({
  base,
  barra,
  faixas,
  children,
}: {
  base: string
  barra: ReactNode
  faixas: ReactNode
  children: ReactNode
}) {
  const caminho = usePathname()
  if (ehEditorDeFluxo(caminho, base)) return children

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      {barra}
      <div className="relative min-w-0 flex-1 md:overflow-auto">
        {faixas}
        {children}
      </div>
    </div>
  )
}
