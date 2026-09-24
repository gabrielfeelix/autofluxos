'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore, type ReactNode } from 'react'

const CHAVE = 'autofluxos:faixas-fechadas'

function assinar(avisar: () => void) {
  window.addEventListener('storage', avisar)
  return () => window.removeEventListener('storage', avisar)
}

function fechadas(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as string[]
  } catch {
    return []
  }
}

/**
 * Uma faixa de aviso que a pessoa fecha. Fechada, fica fechada naquele
 * navegador para aquele aviso; o aviso seguinte (outra chave) aparece.
 */
export function FaixaFechavel({ chave, href, tom, children }: { chave: string; href: string; tom: 'aviso' | 'info'; children: ReactNode }) {
  // No servidor, fechada: a faixa só aparece depois de ler o navegador.
  const jaFechada = useSyncExternalStore(assinar, () => fechadas().includes(chave), () => true)
  const [fechouAgora, setFechouAgora] = useState(false)
  if (jaFechada || fechouAgora) return null

  const cor = tom === 'aviso' ? 'border-amber-400/30 bg-amber-400/[0.1] text-aviso' : 'border-info/30 bg-info/10 text-info'
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b px-4 py-2 md:px-6 ${cor}`}>
      <p className="min-w-0 flex-1 text-[12.5px] leading-5">{children}</p>
      <span className="flex items-center gap-1">
        <Link href={href} className="rounded-lg border border-current/40 px-2.5 py-1 text-[11.5px] font-bold transition hover:bg-current/10">
          Ver plano e consumo
        </Link>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => {
            try {
              localStorage.setItem(CHAVE, JSON.stringify([...fechadas().slice(-30), chave]))
            } catch {
              // Sem armazenamento, fecha só nesta visita.
            }
            setFechouAgora(true)
          }}
          className="rounded-lg px-2 py-1 text-[14px] leading-none opacity-70 transition hover:opacity-100"
        >
          ×
        </button>
      </span>
    </div>
  )
}
