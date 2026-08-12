import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Cliente } from '@/server/repos/clientes'
import { LogoDoCliente } from './logo-cliente'
import { PainelShell } from './shell'

export type AbaDoCliente = 'inicio' | 'fluxos' | 'leads' | 'ajustes'

const ABAS: { chave: AbaDoCliente; rotulo: string; href: string }[] = [
  { chave: 'inicio', rotulo: 'Início', href: '' },
  { chave: 'fluxos', rotulo: 'Fluxos', href: '/fluxos' },
  { chave: 'leads', rotulo: 'Leads', href: '/leads' },
  { chave: 'ajustes', rotulo: 'Ajustes', href: '/ajustes' },
]

/**
 * O cabeçalho das telas do cliente: trilha, identidade e abas.
 *
 * **É componente, não `layout.tsx`, e isso é decisão.** Como layout ele
 * envolveria tudo que mora sob `/clientes/[id]/`, inclusive o editor de fluxo —
 * que é tela cheia por natureza, com a barra de blocos de um lado e o painel do
 * outro. Espremido dentro de barra lateral, trilha, título e abas, o desenho
 * perdia metade do espaço e ficava difícil de mexer. Layout no Next não se
 * "desliga" num filho: quem não quer, não pode estar embaixo.
 *
 * Como componente, quem quer o cabeçalho chama; o editor simplesmente não
 * chama. O custo é passar `ativa` na mão em vez de deduzir do segmento — e
 * passar na mão é o que permite `contexto` e `numero` acenderem "Ajustes".
 */
export function ClienteShell({
  cliente,
  ativa,
  children,
}: {
  cliente: Cliente
  ativa: AbaDoCliente
  children: ReactNode
}) {
  return (
    <PainelShell>
      <div className="app-page-enter flex min-h-full flex-col">
        <header className="shrink-0 px-[42px] pt-[26px]">
          <nav className="mb-3 text-[12.5px] text-dim">
            <Link href="/" className="text-muted transition hover:text-accent">
              Clientes
            </Link>
            <span className="mx-2">/</span>
            <span className="text-soft">{cliente.nome}</span>
          </nav>

          <div className="mb-[16px] flex items-center gap-3.5">
            <LogoDoCliente cliente={cliente} tamanho={44} />
            <h1 className="text-[25px] font-bold tracking-[-0.02em]">{cliente.nome}</h1>
          </div>

          <nav className="-mb-px flex gap-1 border-b border-white/[0.06]" aria-label="Seções do cliente">
            {ABAS.map((aba) => {
              const acesa = aba.chave === ativa
              return (
                <Link
                  key={aba.chave}
                  href={`/clientes/${cliente.id}${aba.href}`}
                  aria-current={acesa ? 'page' : undefined}
                  className={`rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-bold transition ${
                    acesa ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
                  }`}
                >
                  {aba.rotulo}
                </Link>
              )
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </PainelShell>
  )
}
