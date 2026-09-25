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
  cabecalho,
  faixas,
  children,
}: {
  base: string
  barra: ReactNode
  /** O cabeçalho do computador. Fica fora da rolagem: a página rola por baixo dele. */
  cabecalho: ReactNode
  faixas: ReactNode
  children: ReactNode
}) {
  const caminho = usePathname()
  if (ehEditorDeFluxo(caminho, base)) return children

  return (
    <div className="flex min-h-screen flex-col md:h-dvh md:flex-row md:overflow-hidden">
      {barra}
      {/*
        No celular a barra de baixo é fixa e cobre o pé da tela: o miolo ganha
        a altura dela embaixo, para o último item não ficar escondido atrás.
      */}
      <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        {faixas}
        {cabecalho}
        <div className="app-miolo-com-barra relative min-h-0 min-w-0 flex-1 md:overflow-auto">{children}</div>
      </div>
    </div>
  )
}
