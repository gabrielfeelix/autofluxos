/**
 * As cores que uma etiqueta pode ter.
 *
 * Lista fechada, e nomes em vez de hexadecimal: a paleta é do produto. Deixar
 * o cliente digitar `#ffffff` é deixá-lo criar uma etiqueta invisível, e uma
 * etiqueta invisível não dá erro, ela só some da tela.
 *
 * Mora em `core/` porque a tela precisa dela e o servidor também, e porque a
 * validação do que chega do formulário não pode ser feita em dois lugares.
 */

export const CORES_DE_ETIQUETA = ['cinza', 'azul', 'verde', 'ambar', 'rosa', 'roxo'] as const

export type CorDeEtiqueta = (typeof CORES_DE_ETIQUETA)[number]

export function ehCorDeEtiqueta(valor: string): valor is CorDeEtiqueta {
  return (CORES_DE_ETIQUETA as readonly string[]).includes(valor)
}

/**
 * Como cada cor pinta uma ficha.
 *
 * As classes são escritas inteiras de propósito: o Tailwind lê o texto do
 * arquivo para decidir o que gerar, e `bg-${cor}-400/10` montado em tempo de
 * execução simplesmente não existiria na folha de estilo, a etiqueta ficaria
 * sem cor nenhuma, sem erro nenhum.
 *
 * Texto na cor escura da família sobre o fundo claro dela (contraste acima de
 * 4.5:1). Antes só existia a versão do tema escuro, e no claro a etiqueta era
 * texto quase branco sobre fundo quase branco.
 */
export const CLASSE_DA_COR: Record<CorDeEtiqueta, string> = {
  cinza: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-muted',
  azul: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/[0.12] dark:text-sky-200',
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-200',
  ambar: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/[0.12] dark:text-amber-100',
  rosa: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/[0.12] dark:text-rose-200',
  roxo: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/[0.12] dark:text-violet-200',
}

/** O nome que a tela mostra ao escolher a cor. */
export const ROTULO_DA_COR: Record<CorDeEtiqueta, string> = {
  cinza: 'Cinza',
  azul: 'Azul',
  verde: 'Verde',
  ambar: 'Âmbar',
  rosa: 'Rosa',
  roxo: 'Roxo',
}

/** Teto do nome. Etiqueta é rótulo, não frase, acima disso ela quebra a linha. */
export const LIMITE_DO_NOME = 32
