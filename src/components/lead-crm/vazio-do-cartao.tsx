import type { ReactNode } from 'react'

/**
 * O cartão da ficha sem nada dentro: a ilustração e a frase do que fazer.
 *
 * O mesmo desenho do vazio de Relatórios (`relatorios/graficos.tsx`, `Vazio`):
 * moldura tracejada, desenho em fantasma e a frase embaixo. Uma linha de texto
 * cinza solta no cartão parecia defeito de carregamento, e a ficha tem muitos
 * cartões que nascem vazios, então era a primeira impressão de toda pessoa
 * nova. Cada cartão escolhe um desenho do assunto dele, e dois cartões da
 * mesma aba não repetem desenho.
 *
 * A ilustração entra no tamanho de cartão (84px), e não no de tela cheia.
 */
export function VazioDoCartao({
  ilustracao,
  children,
  className = 'm-4',
}: {
  ilustracao: ReactNode
  children: ReactNode
  /** A margem dentro do cartão. Quem já tem folga própria passa `''`. */
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 py-6 text-center [&_svg.ilu]:h-[84px] ${className}`}
    >
      {ilustracao}
      <p className="max-w-[360px] text-[12.5px] leading-5 text-dim">{children}</p>
    </div>
  )
}
