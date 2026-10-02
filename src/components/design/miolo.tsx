import type { ReactNode } from 'react'

/**
 * As larguras de tela, por nome.
 *
 * Eram 36 `<main>` escritos à mão, com a mesma folga em duas ordens de classe
 * e quatro larguras soltas (1100, 1280, 1440, nenhuma). Pelo nome dá para
 * saber o porquê: `leitura` é formulário e texto, `larga` é lista com
 * colunas, `cheia` é tabela e quadro, `toda` é o que precisa da janela.
 */
const LARGURA = {
  leitura: 'max-w-[1100px]',
  larga: 'max-w-[1280px]',
  cheia: 'max-w-[1440px]',
  toda: '',
} as const

export type LarguraDoMiolo = keyof typeof LARGURA

/** O miolo de uma tela da conta: largura e folga de sempre. */
export function Miolo({
  largura = 'cheia',
  className = '',
  children,
}: {
  largura?: LarguraDoMiolo
  className?: string
  children: ReactNode
}) {
  return <main className={`w-full ${LARGURA[largura]} px-4 pt-[26px] pb-[42px] md:px-[42px] ${className}`}>{children}</main>
}
