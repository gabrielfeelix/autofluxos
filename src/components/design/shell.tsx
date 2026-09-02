import Link from 'next/link'
import type { ReactNode } from 'react'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { acaoSair } from '@/server/acoes-conta'
import { ehAdminDaPlataforma, sessaoAtual } from '@/server/sessao'
import { BotaoDeAjuda } from './botao-de-ajuda'
import { Marca } from './marca'

/**
 * A moldura da lista de clientes — a visão de quem opera a 4YU.
 *
 * **Duas formas, e a diferença não é só largura.** No desktop a barra é uma
 * coluna fixa e só o conteúdo rola — é o que mantém a navegação sempre à vista
 * numa tela de trabalho. No celular a mesma coluna comeria 226px dos 390px
 * disponíveis, então ela vira uma faixa no topo e a página inteira volta a
 * rolar como página. `h-screen` some junto: prender a altura na viewport de um
 * celular briga com a barra de endereço que aparece e some, e o resultado é
 * conteúdo cortado que não rola.
 *
 * O rodapé mostra **quem está logado de verdade** desde que existe login por
 * usuário. Antes dizia "Operador 4YU · Administrador" para qualquer um, o que
 * era honesto quando havia uma senha só e deixa de ser no instante em que duas
 * pessoas diferentes podem estar olhando a mesma tela.
 */
export async function PainelShell({ children }: { children: ReactNode }) {
  const sessao = await sessaoAtual()

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-[700px] md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-row items-center gap-3 border-b border-white/[0.06] bg-white/[0.014] px-4 py-3 md:w-[226px] md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:px-3.5 md:pt-5 md:pb-4">
        <div className="flex items-center gap-3 md:mb-5 md:px-2">
          <Marca />
          <span className="ml-auto">
            <BotaoDeAjuda />
          </span>
        </div>

        <Link
          href="/painel"
          className="flex items-center gap-2.5 rounded-[10px] bg-accent/[0.12] px-2.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent/[0.16]"
        >
          <IconeClientes />
          Clientes
        </Link>

        {ehAdminDaPlataforma(sessao) && (
          <Link
            href="/admin/contas"
            className="mt-0.5 hidden items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold text-muted transition hover:bg-white/[0.04] hover:text-white md:flex"
          >
            <IconeAdministracao />
            Administração
          </Link>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 border-white/[0.06] md:border-t md:px-1.5 md:pt-3.5">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-[linear-gradient(135deg,#334155,#1e293b)] text-[11px] font-bold text-[#b9c2d0]">
            {sessao ? iniciais(sessao.usuario.nome) : '4Y'}
          </span>
          {/* Nome e papel são contexto, não navegação: some no celular para o
              topo caber sem virar duas linhas. O botão de sair fica. */}
          <span className="hidden min-w-0 flex-1 md:block">
            <span className="block truncate text-[12.5px] font-semibold">
              {sessao?.usuario.nome ?? 'Operador 4YU'}
            </span>
            <span className="block truncate text-[11px] text-dim">
              {sessao?.usuario.email ?? ''}
            </span>
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
        {children}
      </div>
    </div>
  )
}

/** As iniciais que cabem no círculo. Duas letras, nome e sobrenome quando há. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase()
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase()
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

function IconeAdministracao() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7.5 1.3 12.8 3.4v4c0 3.1-2.2 5.4-5.3 6.3-3.1-.9-5.3-3.2-5.3-6.3v-4L7.5 1.3Z" />
    </svg>
  )
}
