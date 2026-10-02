import type { ReactNode } from 'react'

/**
 * Pílula: rótulo de estado ou quantidade ao lado de um título ("64 contatos",
 * "Aguardando", "No ar"). Uma altura, uma fonte; o tom diz o que ela é.
 *
 * Solta na casca azul, os tons claros viram pastilha clara sozinhos (bloco
 * "A casca" do `globals.css`); o `neutro` lê branco translúcido.
 */
const TOM_DA_PILULA = {
  neutro: 'border-line bg-surface text-muted',
  destaque: 'border-primary/20 bg-primary-weak text-primary',
  perigo: 'border-rose-400/25 bg-rose-400/[0.09] text-perigo',
  aviso: 'border-amber-400/30 bg-amber-400/[0.12] text-aviso',
  ok: 'border-emerald-400/25 bg-emerald-400/[0.1] text-ok',
} as const

export type TomDaPilula = keyof typeof TOM_DA_PILULA

export function Pilula({
  tom = 'neutro',
  className = '',
  children,
  titulo,
}: {
  tom?: TomDaPilula
  className?: string
  children: ReactNode
  titulo?: string
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold whitespace-nowrap tabular-nums ${TOM_DA_PILULA[tom]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * Badge: o número pequeno e cheio que pede atenção (não lidas na barra,
 * alertas, "+10" do Colunas, filtros ligados). Sempre sólido com texto branco
 * para ler sobre qualquer fundo, inclusive o item aceso da barra, que é azul.
 *
 * - `alerta` (coral): pede ação;
 * - `destaque` (cor primária): só informa quantos.
 */
export function Badge({
  tom = 'destaque',
  rotulo,
  className = '',
  children,
}: {
  tom?: 'alerta' | 'destaque'
  /** Frase para leitor de tela e dica ("3 conversas não lidas"). */
  rotulo?: string
  className?: string
  children: ReactNode
}) {
  return (
    <span
      title={rotulo}
      aria-label={rotulo}
      className={`inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full px-1.5 text-[10.5px] leading-none font-bold tabular-nums ${
        tom === 'alerta' ? 'bg-contador text-white' : 'bg-primary text-[var(--primary-ink)]'
      } ${className}`}
    >
      {children}
    </span>
  )
}

/** "99+" a partir do teto, para badge não esticar a linha. */
export function teto(quantidade: number, limite = 99): string {
  return quantidade > limite ? `${limite}+` : String(quantidade)
}
