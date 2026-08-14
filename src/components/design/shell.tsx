import Link from 'next/link'
import type { ReactNode } from 'react'
import { acaoSair } from '@/server/auth-actions'
import { Marca } from './marca'

/**
 * A moldura do painel.
 *
 * **Duas formas, e a diferença não é só largura.** No desktop a barra é uma
 * coluna fixa e só o conteúdo rola — é o que mantém a navegação sempre à vista
 * numa tela de trabalho. No celular a mesma coluna comeria 226px dos 390px
 * disponíveis, então ela vira uma faixa no topo e a página inteira volta a
 * rolar como página. `h-screen` some junto: prender a altura na viewport de um
 * celular briga com a barra de endereço que aparece e some, e o resultado é
 * conteúdo cortado que não rola.
 */
export function PainelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-row items-center gap-3 border-b border-white/[0.06] bg-white/[0.014] px-4 py-3 md:w-[226px] md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:px-3.5 md:pt-5 md:pb-4">
        <div className="md:mb-5 md:px-2">
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

        <div className="flex items-center gap-2.5 border-white/[0.06] md:border-t md:px-1.5 md:pt-3.5">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-[linear-gradient(135deg,#334155,#1e293b)] text-[11px] font-bold text-[#b9c2d0]">
            4Y
          </span>
          {/* Nome e papel são contexto, não navegação: some no celular para o
              topo caber sem virar duas linhas. O botão de sair fica. */}
          <span className="hidden min-w-0 flex-1 md:block">
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

      <div className="relative min-w-0 flex-1 md:overflow-auto">{children}</div>
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
