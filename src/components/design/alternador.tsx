import Link from 'next/link'
import type { ReactNode } from 'react'

export type OpcaoDoAlternador<C extends string> = {
  chave: C
  rotulo: ReactNode
  /** Com `href`, a opção é link (o modo mora no endereço). */
  href?: string
  icone?: ReactNode
  /** Número discreto depois do rótulo ("Palavras-chave 4"). */
  contagem?: number
  titulo?: string
}

/**
 * Um entre poucos modos, o "Quadro | Lista" de Negócios (`.alternador` no
 * `globals.css`). Toda escolha de modo da conta usa este: lista e agenda,
 * minhas e da equipe, grade e lista, o período do relatório.
 *
 * Link quando o modo está no endereço; botão (`aoEscolher`) quando é estado
 * da tela.
 */
export function Alternador<C extends string>({
  rotulo,
  opcoes,
  ativa,
  aoEscolher,
  className = '',
}: {
  /** O nome do grupo para leitor de tela ("Ver negócios como"). */
  rotulo: string
  opcoes: OpcaoDoAlternador<C>[]
  ativa: C
  aoEscolher?: (chave: C) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={rotulo} className={`alternador ${className}`}>
      {opcoes.map((opcao) => {
        const acesa = opcao.chave === ativa
        const conteudo = (
          <>
            {opcao.icone}
            {opcao.rotulo}
            {opcao.contagem !== undefined && opcao.contagem > 0 && (
              <span className="text-[11.5px] font-medium opacity-70 tabular-nums">{opcao.contagem}</span>
            )}
          </>
        )
        return opcao.href ? (
          <Link
            key={opcao.chave}
            href={opcao.href}
            scroll={false}
            title={opcao.titulo}
            aria-current={acesa ? 'page' : undefined}
            className="alternador-opcao"
          >
            {conteudo}
          </Link>
        ) : (
          <button
            key={opcao.chave}
            type="button"
            title={opcao.titulo}
            aria-pressed={acesa}
            onClick={() => aoEscolher?.(opcao.chave)}
            className="alternador-opcao"
          >
            {conteudo}
          </button>
        )
      })}
    </div>
  )
}
