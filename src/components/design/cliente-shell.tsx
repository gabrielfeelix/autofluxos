import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Cliente } from '@/server/repos/clientes'
import { LogoDoCliente } from './logo-cliente'
import { PainelShell } from './shell'

export type AbaDoCliente = 'inicio' | 'fluxos' | 'leads' | 'inbox' | 'ajustes'

const ABAS: { chave: AbaDoCliente; rotulo: string; href: string }[] = [
  { chave: 'inicio', rotulo: 'Início', href: '' },
  { chave: 'fluxos', rotulo: 'Fluxos', href: '/fluxos' },
  // "Contatos", não "Leads". Lead é um **estado** por que um contato passa —
  // quem chegou por anúncio e ainda não fechou. O aluno que remarca aula há
  // seis meses é contato e nunca vai preencher coluna de qualificação, e era
  // ele que a tela chamava de lead. Ver docs/PLANO-PRODUTO.md §4.2.
  //
  // A rota continua `/leads`: trocá-la quebraria endereço guardado e cada
  // `revalidatePath` do código, para arrumar uma palavra que só aparece aqui.
  { chave: 'leads', rotulo: 'Contatos', href: '/leads' },
  { chave: 'inbox', rotulo: 'Inbox', href: '/inbox' },
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
        <header className="shrink-0 px-4 md:px-[42px] pt-[26px]">
          <nav className="mb-3 text-[12.5px] text-dim">
            {/* Sublinhado, e não só cor: dentro de um texto corrido, link que
                só muda de cor some para quem não distingue esses dois tons
                (WCAG 1.4.1, nível A). */}
            <Link href="/" className="text-muted underline underline-offset-2 transition hover:text-accent">
              Clientes
            </Link>
            <span className="mx-2">/</span>
            <span className="text-soft">{cliente.nome}</span>
          </nav>

          <div className="mb-[16px] flex items-center gap-3.5">
            <LogoDoCliente cliente={cliente} tamanho={44} />
            <h1 className="min-w-0 truncate text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
              {cliente.nome}
            </h1>
          </div>

          {/* Cinco abas não cabem em 390px. Rolar na horizontal aqui dentro é o
              que impede a página inteira de rolar de lado — e nenhuma aba some. */}
          <nav
            className="-mb-px flex gap-1 overflow-x-auto border-b border-white/[0.06]"
            aria-label="Seções do cliente"
          >
            {ABAS.map((aba) => {
              const acesa = aba.chave === ativa
              return (
                <Link
                  key={aba.chave}
                  href={`/clientes/${cliente.id}${aba.href}`}
                  aria-current={acesa ? 'page' : undefined}
                  className={`shrink-0 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-bold transition ${
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
