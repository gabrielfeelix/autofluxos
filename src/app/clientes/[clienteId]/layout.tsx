import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AbasDoCliente } from '@/components/design/abas-cliente'
import { PainelShell } from '@/components/design/shell'
import { acharCliente } from '@/server/repos/clientes'

/**
 * O cabeçalho que toda tela deste cliente compartilha.
 *
 * Antes cada tela trazia o próprio shell, a própria trilha e o próprio título,
 * e as seções do cliente eram barras horizontais do tamanho de um card que se
 * comportavam como link — davam a entender que eram conteúdo, não navegação.
 * Aqui a navegação é navegação: fica no topo, uma vez, e diz onde você está.
 *
 * Buscar o cliente aqui **e** na página parece desperdício e não é: o Next
 * deduplica a mesma requisição dentro de um render, e a alternativa (passar o
 * cliente por contexto) obrigaria toda página a virar componente de cliente.
 */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <PainelShell>
      <div className="app-page-enter flex min-h-full flex-col">
        <header className="shrink-0 px-[42px] pt-[30px]">
          <nav className="mb-3 text-[12.5px] text-dim">
            <Link href="/" className="text-muted transition hover:text-accent">
              Clientes
            </Link>
            <span className="mx-2">/</span>
            <span className="text-soft">{cliente.nome}</span>
          </nav>

          <h1 className="mb-[18px] text-[25px] font-bold tracking-[-0.02em]">{cliente.nome}</h1>

          <AbasDoCliente clienteId={cliente.id} />
        </header>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </PainelShell>
  )
}
