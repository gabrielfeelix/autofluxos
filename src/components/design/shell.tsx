import Link from 'next/link'
import type { ReactNode } from 'react'
import { acaoSair } from '@/server/auth-actions'
import { Marca } from './marca'

export function PainelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen min-h-[700px] overflow-hidden">
      <aside className="flex w-[226px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.014] px-3.5 pt-5 pb-4">
        <div className="mb-5 px-2">
          <Marca />
        </div>

        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[10px] bg-accent/[0.12] px-2.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent/[0.16]"
        >
          <IconeClientes />
          Clientes
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 border-t border-white/[0.06] px-1.5 pt-3.5">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-[linear-gradient(135deg,#334155,#1e293b)] text-[11px] font-bold text-[#b9c2d0]">
            4Y
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">Operador 4YU</span>
            <span className="block text-[11px] text-dim">Administrador</span>
          </span>
          <form action={acaoSair}>
            <button
              type="submit"
              className="rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  )
}

function IconeClientes() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" className="text-accent">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.6" fill="currentColor" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.6" fill="currentColor" opacity=".45" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.6" fill="currentColor" opacity=".45" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.6" fill="currentColor" opacity=".45" />
    </svg>
  )
}
