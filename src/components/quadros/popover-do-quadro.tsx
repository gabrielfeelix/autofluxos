'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** A top layer evita que a rolagem das colunas corte as ações. */
export function PopoverDoQuadro({
  rotulo,
  gatilho,
  children,
  className = '',
  largura = 264,
}: {
  rotulo: string
  gatilho: ReactNode
  children: ReactNode
  className?: string
  largura?: number
}) {
  const id = useId()
  const painel = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!aberto || !painel.current) return
    const caixa = painel.current.getBoundingClientRect()
    if (caixa.bottom > window.innerHeight - 12) {
      setPosicao((atual) => ({
        ...atual,
        top: Math.max(12, window.innerHeight - caixa.height - 12),
      }))
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fechar = (evento: Event) => {
      if (evento.target instanceof Node && painel.current?.contains(evento.target)) return
      painel.current?.hidePopover()
    }
    window.addEventListener('resize', fechar)
    window.addEventListener('scroll', fechar, true)
    return () => {
      window.removeEventListener('resize', fechar)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={id}
        className={`quadro-tool ${className}`}
        onClick={(evento) => {
          const caixa = evento.currentTarget.getBoundingClientRect()
          setPosicao({
            top: caixa.bottom + 8,
            left: Math.max(12, Math.min(caixa.left, window.innerWidth - largura - 12)),
          })
        }}
      >
        {gatilho}
      </button>
      <div
        ref={painel}
        id={id}
        popover="auto"
        aria-label={rotulo}
        onToggle={(evento) => setAberto(evento.newState === 'open')}
        style={{
          ...posicao,
          width: largura,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100dvh - 24px)',
        }}
        className="quadro-popover"
        onClick={(evento) => {
          if ((evento.target as HTMLElement).closest('[data-fechar-popover]'))
            painel.current?.hidePopover()
        }}
      >
        {children}
      </div>
    </>
  )
}

export function IconeDoQuadro({
  tipo,
}: {
  tipo: 'busca' | 'filtro' | 'ordem' | 'seta' | 'menu' | 'quadro' | 'ajustes' | 'pessoas' | 'ajuda'
}) {
  const caminhos = {
    busca: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    filtro: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    ordem: (
      <>
        <path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4" />
      </>
    ),
    seta: <path d="m7 10 5 5 5-5" />,
    menu: (
      <>
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
    quadro: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 8v8M15 8v5" />
      </>
    ),
    ajustes: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    pessoas: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" />
      </>
    ),
    ajuda: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 16h.01" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {caminhos[tipo]}
    </svg>
  )
}
