import type { ReactNode } from 'react'

/**
 * O cartão de conexão, o mesmo desenho de "Todas as conexões": logo e selo no
 * topo, nome, categoria, uma frase, e as ações no pé.
 *
 * As telas de Anúncios e Credenciais eram linhas esticadas na largura toda,
 * com o botão a um metro do nome que ele afeta. Em cartão, cada coisa ligada
 * é um objeto inteiro, lido de cima para baixo, e as telas filhas falam a
 * mesma língua da tela mãe.
 */
export function CartaoDeConexao({
  logo,
  selo,
  titulo,
  categoria,
  rodape,
  tracejado = false,
  children,
}: {
  logo: ReactNode
  selo?: ReactNode
  titulo: ReactNode
  categoria?: ReactNode
  /** As ações, sempre no pé, onde o olho termina a leitura do cartão. */
  rodape?: ReactNode
  /** O lugar vazio: o que ainda não existe, mas cabe aqui. */
  tracejado?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`app-card flex min-w-0 flex-col p-4 ${tracejado ? 'border-dashed border-strong' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {logo}
        {selo}
      </div>
      <p className="truncate text-[13.5px] font-bold tracking-[-0.01em]">{titulo}</p>
      {categoria && <p className="mt-0.5 text-[11px] font-semibold text-dim">{categoria}</p>}
      {children && <div className="mt-1.5 text-[12px] leading-5 text-muted">{children}</div>}
      <span className="flex-1" />
      {rodape && <div className="mt-4 flex flex-wrap items-center gap-2">{rodape}</div>}
    </div>
  )
}

/** A grade das telas de conexão: a mesma de "Todas as conexões". */
export const GRADE_DE_CONEXOES = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
