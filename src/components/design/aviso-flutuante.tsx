'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Um cartão no rodapé que diz o resultado de uma ação e some sozinho.
 *
 * Vai para o `body` por portal: dentro de listas, algum ancestral prende o
 * `fixed`, e no celular o cartão nascia abaixo da tela. Para leitor de tela,
 * quem chama mantém uma região `role="status"` sempre montada com o mesmo
 * texto; o cartão é só a parte visível (`aria-hidden`).
 */
export function AvisoFlutuante({
  children,
  tom = 'neutro',
  aoSumir,
  duracao = 8000,
}: {
  children: React.ReactNode
  tom?: 'neutro' | 'erro'
  aoSumir: () => void
  duracao?: number
}) {
  useEffect(() => {
    const t = setTimeout(aoSumir, duracao)
    return () => clearTimeout(t)
  }, [aoSumir, duracao])

  return createPortal(
    <div
      aria-hidden
      className={`fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border bg-panel px-4 py-3 text-[12.5px] leading-5 shadow-lg ${
        tom === 'erro' ? 'border-rose-400/40 text-perigo' : 'border-line text-ink'
      }`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        tabIndex={-1}
        onClick={aoSumir}
        className="-mr-1 shrink-0 rounded px-1 text-dim hover:text-ink"
      >
        ×
      </button>
    </div>,
    document.body,
  )
}
