import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * "1–50 de 230" com Anterior e Próxima.
 *
 * Links de verdade, não botões com JavaScript: abrem em outra aba, funcionam
 * antes da hidratação e entram no histórico do navegador.
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
  hrefDaPagina,
  rotulo,
}: {
  pagina: number
  porPagina: number
  total: number
  hrefDaPagina: (pagina: number) => string
  rotulo: string
}) {
  if (total === 0) return null
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const primeiro = (pagina - 1) * porPagina + 1
  const ultimo = Math.min(total, pagina * porPagina)

  return (
    <nav aria-label={rotulo} className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11.5px] text-muted tabular-nums">
        {primeiro}–{ultimo} de {total}
      </p>
      {paginas > 1 && (
        <div className="flex items-center gap-2">
          <Passo href={hrefDaPagina(pagina - 1)} ativo={pagina > 1}>
            ‹ Anterior
          </Passo>
          <span className="text-[11.5px] font-semibold text-muted tabular-nums">
            Página {pagina} de {paginas}
          </span>
          <Passo href={hrefDaPagina(pagina + 1)} ativo={pagina < paginas}>
            Próxima ›
          </Passo>
        </div>
      )}
    </nav>
  )
}

function Passo({ href, ativo, children }: { href: string; ativo: boolean; children: ReactNode }) {
  const classe = 'rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition'
  if (!ativo) {
    return (
      <span aria-disabled="true" className={`${classe} border-line text-dim`}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={`${classe} border-line text-muted hover:border-strong hover:text-ink`}>
      {children}
    </Link>
  )
}
