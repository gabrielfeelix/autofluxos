import type { ReactNode } from 'react'
import { Marca } from './marca'
import { BarraLateral } from './barra-lateral'
import { type AbaDoCliente, ITENS } from './secoes-do-cliente'

/** Usa a mesma estrutura da navegação pronta, incluindo grupos e recolhimento. */
export function EsqueletoDoCliente({ ativa, children }: { ativa: AbaDoCliente; children: ReactNode }) {
  return <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
    <BarraLateral carregando marca={<Marca />} identidadeNoCelular={<span className="h-4 w-20 animate-pulse rounded bg-surface" />} voltar={null}
      itens={ITENS.map((item) => ({ ...item, href: '#', acesa: item.chave === ativa }))}
      rodape={<p className="text-sm text-dim">Carregando sua conta…</p>} />
    <div className="relative min-w-0 flex-1 md:overflow-auto"><div className="flex min-h-full flex-col md:h-full">{children}</div></div>
  </div>
}
