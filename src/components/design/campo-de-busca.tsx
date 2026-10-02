'use client'

import { IconeDoQuadro } from '@/components/quadros/popover-do-quadro'

/**
 * O campo de busca da casa, o da barra de Contatos: branco, largo, lupa à
 * esquerda, 36px (a altura `md` dos botões ao lado).
 *
 * O `campo-de-busca` no contêiner é o que devolve os tokens claros à lupa:
 * solta na casca, ela herdava o `--dim` branco e sumia em cima do campo
 * branco, que é por que a busca de Alertas "não parecia" a de Contatos.
 */
export function CampoDeBusca({
  valor,
  aoDigitar,
  aoEnviar,
  placeholder,
  rotulo,
  className = '',
}: {
  valor: string
  aoDigitar: (valor: string) => void
  /** Enter: busca na hora, sem esperar a pausa da digitação. */
  aoEnviar: () => void
  placeholder: string
  /** O nome para leitor de tela ("Buscar contato por nome ou telefone"). */
  rotulo: string
  className?: string
}) {
  return (
    <form
      role="search"
      onSubmit={(evento) => {
        evento.preventDefault()
        aoEnviar()
      }}
      className={`campo-de-busca relative w-full sm:max-w-[380px] sm:flex-1 ${className}`}
    >
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
        <IconeDoQuadro tipo="busca" />
      </span>
      <input
        type="search"
        value={valor}
        onChange={(evento) => aoDigitar(evento.currentTarget.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        maxLength={80}
        className="app-field h-9 py-2 pr-3 pl-9 text-[13px]"
      />
    </form>
  )
}

/** Um filtro ligado, com o ✕ que o tira ("Busca: ana ×"). */
export function ChipDeFiltro({ rotulo, aoTirar }: { rotulo: string; aoTirar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTirar}
      aria-label={`Remover filtro ${rotulo}`}
      className="flex h-7 max-w-[260px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary-weak px-2.5 font-semibold text-primary transition hover:border-primary/40"
    >
      <span className="truncate">{rotulo}</span>
      <span aria-hidden>×</span>
    </button>
  )
}
