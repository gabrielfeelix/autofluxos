import Link from 'next/link'
import type { ReactNode } from 'react'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { NavegacaoDoAdmin } from '@/components/conta/navegacao-admin'
import { Marca } from '@/components/design/marca'
import { acaoSair } from '@/server/acoes-conta'
import { exigirAdminDaPlataforma } from '@/server/sessao'

/**
 * A área de quem administra a plataforma — as contas, as pessoas e o registro.
 *
 * **Aqui `layout.tsx` é a escolha certa**, ao contrário do que acontece nas
 * telas do cliente. Toda tela desta área usa a mesma moldura e nenhuma delas é
 * tela cheia, então não existe o filho que precisaria se desligar da moldura —
 * que foi o motivo de a moldura do cliente ser componente.
 *
 * O ganho é o que importa: `exigirAdminDaPlataforma()` roda uma vez, aqui, e
 * **toda** rota abaixo herda a conferência. Uma tela nova nasce protegida sem
 * ninguém lembrar de protegê-la.
 */
export default async function LayoutDoAdmin({ children }: { children: ReactNode }) {
  const sessao = await exigirAdminDaPlataforma()

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-white/[0.06] bg-white/[0.014] md:w-[226px] md:border-r md:px-3.5 md:pt-5 md:pb-4">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3 md:mb-5 md:border-0 md:px-2 md:py-0">
          <Marca />
          <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] text-dim">
            admin
          </span>
        </div>

        <Link
          href="/painel"
          className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dim transition hover:text-accent md:mb-1.5 md:flex"
        >
          <span aria-hidden>‹</span> Todos os clientes
        </Link>

        <NavegacaoDoAdmin />

        <div className="hidden flex-1 md:block" />

        <div className="hidden items-center gap-2.5 border-t border-white/[0.06] px-1.5 pt-3.5 md:flex">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">{sessao.usuario.nome}</span>
            <span className="block truncate text-[11px] text-dim">{sessao.usuario.email}</span>
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

      <div className="relative min-w-0 flex-1 md:overflow-auto">
        <FaixaDeImpersonacao />
        <div className="app-page-enter">{children}</div>
      </div>
    </div>
  )
}
