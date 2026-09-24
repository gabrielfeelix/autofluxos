import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AbasDaOrganizacao } from '@/components/admin/abas-da-organizacao'
import { Selo } from '@/components/admin/partes'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { acharOrganizacao } from '@/server/repos/organizacoes'
import { planoVigente } from '@/server/repos/planos'

/**
 * O detalhe de uma organização: cabeçalho fixo e abas.
 *
 * O cabeçalho responde "que organização é esta e em que estado está" sem
 * abrir aba nenhuma; o botão principal é **Abrir como suporte**, porque é o
 * que se faz na maioria das vezes que se chega aqui.
 */
export default async function LayoutDaOrganizacao({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharOrganizacao(id)
  if (!organizacao) notFound()
  const plano = await planoVigente(organizacao.plano || 'essencial')
  const base = `/admin/organizacoes/${organizacao.id}`

  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <nav aria-label="Trilha" className="mb-3 text-[12px] text-dim">
        <Link href="/admin/organizacoes" className="transition hover:text-primary">
          Organizações
        </Link>
        <span aria-hidden className="mx-1.5">›</span>
        <span className="text-muted">{organizacao.nome}</span>
      </nav>
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <LogoDoCliente cliente={organizacao} tamanho={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">{organizacao.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            <Selo tom="destaque">{plano.nome}</Selo>
            {organizacao.suspensaEm ? <Selo tom="alerta">Suspensa</Selo> : organizacao.esperando > 0 ? <Selo tom="aviso">{organizacao.esperando} esperando</Selo> : <Selo tom="ok">Ativa</Selo>}
            <span className="ml-1 truncate">{organizacao.responsavel || organizacao.email || 'sem responsável no cadastro'}</span>
          </p>
        </div>
        <Link href={`/clientes/${organizacao.id}`} className="app-primary-button w-full px-4 py-2.5 text-center text-[13px] sm:w-auto">
          Abrir como suporte
        </Link>
      </header>
      <AbasDaOrganizacao base={base} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </main>
  )
}
