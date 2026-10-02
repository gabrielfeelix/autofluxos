import Link from 'next/link'
import type { ReactNode } from 'react'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { enderecoDaLista } from '@/core/lista-de-fluxos'

/**
 * A tabela da casa, a de Contatos (`app/clientes/[clienteId]/leads`): cartão
 * que cresce até o fim da página e rola por dentro, cabeçalho em versalete
 * preso no topo, primeira coluna presa quando rola de lado, o mesmo fundo de
 * linha. Nasceu na administração (`admin/partes.tsx`) e subiu para cá para as
 * telas da conta pararem de escrever a própria.
 *
 * Linha: `<tr className={`group border-b border-line ${FUNDO_DA_LINHA}`}>`;
 * célula fixa: `${COLUNA_FIXA} ${FUNDO_DA_FIXA}`; ação da linha em `botao-sm`;
 * seleção com `caixa-de-marcar`.
 */
export const CLASSE_DO_CABECALHO =
  'px-4 py-3 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap text-dim uppercase'

/** Mesmo fundo das linhas de Contatos, escrito por extenso (o Tailwind lê o texto). */
export const FUNDO_DA_LINHA = 'hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))]'
export const FUNDO_DA_FIXA = 'bg-panel group-hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))]'
/** A primeira coluna, presa na esquerda quando a tabela rola de lado. */
export const COLUNA_FIXA =
  'sticky left-0 z-[2] min-w-[200px] max-w-[320px] group-data-[rolada=sim]/rolagem:shadow-[inset_-1px_0_0_var(--line)]'

/** O cartão da tabela: cresce até o fim da página e rola por dentro. */
export function Tabela({ largura = 760, children }: { largura?: number; children: ReactNode }) {
  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full border-collapse text-left" style={{ minWidth: largura }}>
          {children}
        </table>
      </RolagemDaTabela>
    </div>
  )
}

export function Th({ children, className = '', fixa = false }: { children?: ReactNode; className?: string; fixa?: boolean }) {
  return (
    <th scope="col" className={`${CLASSE_DO_CABECALHO} sticky top-0 z-[1] bg-panel ${fixa ? `${COLUNA_FIXA} left-0 z-[3]` : ''} ${className}`}>
      {children}
    </th>
  )
}

/**
 * O cabeçalho que ordena. É um link, não um botão: a ordem mora no endereço,
 * então voltar no navegador e mandar o link para alguém devolvem a mesma lista.
 */
export function ThOrdenavel({
  base,
  parametros,
  chave,
  children,
  fixa = false,
  className = '',
}: {
  base: string
  parametros: Record<string, string>
  chave: string
  children: ReactNode
  fixa?: boolean
  className?: string
}) {
  const ativa = parametros.ordem === chave
  const desc = ativa && parametros.direcao !== 'asc'
  const proxima = ativa ? (desc ? 'asc' : 'desc') : 'desc'
  return (
    <th
      scope="col"
      aria-sort={ativa ? (desc ? 'descending' : 'ascending') : undefined}
      className={`${CLASSE_DO_CABECALHO} sticky top-0 z-[1] bg-panel ${fixa ? `${COLUNA_FIXA} left-0 z-[3]` : ''} ${className}`}
    >
      <Link
        href={enderecoDaLista(base, { ...parametros, ordem: chave, direcao: proxima })}
        scroll={false}
        className={`inline-flex items-center gap-1 transition hover:text-ink ${ativa ? 'text-ink' : ''}`}
      >
        {children}
        <span aria-hidden className={ativa ? 'text-primary' : 'opacity-0'}>
          {desc ? '↓' : '↑'}
        </span>
      </Link>
    </th>
  )
}

