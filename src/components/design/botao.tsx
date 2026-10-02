import type { ButtonHTMLAttributes } from 'react'

export type VarianteDoBotao = 'primario' | 'secundario' | 'ferramenta' | 'fantasma' | 'perigo'
export type TamanhoDoBotao = 'sm' | 'md' | 'lg'

const VARIANTE: Record<VarianteDoBotao, string> = {
  primario: 'botao-primario',
  secundario: 'botao-secundario',
  ferramenta: 'quadro-tool',
  fantasma: 'botao-fantasma',
  perigo: 'botao-perigo',
}

/**
 * As classes de um botão na escala da casa (`globals.css`, "A escala de
 * botão"). Para `Link` e `<a>`, que não passam pelo `Botao`:
 * `<Link className={classesDoBotao({ variante: 'secundario' })}>`.
 *
 * - `lg`: ações do topo da tela (no `CabecalhoDaTela` já saem assim sozinhas);
 * - `md`: seção, cartão, formulário, barra de busca (o padrão);
 * - `sm`: ação de linha de tabela e inline.
 */
export function classesDoBotao({
  variante = 'secundario',
  tamanho = 'md',
  icone = false,
  className = '',
}: {
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
  /** Só ícone: quadrado na altura da escala. Passe `aria-label`. */
  icone?: boolean
  className?: string
} = {}): string {
  return [VARIANTE[variante], `botao-${tamanho}`, icone ? 'botao-icone' : '', className].filter(Boolean).join(' ')
}

export function Botao({
  variante,
  tamanho,
  icone,
  className,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
  icone?: boolean
}) {
  return <button type={type} className={classesDoBotao({ variante, tamanho, icone, className })} {...resto} />
}
