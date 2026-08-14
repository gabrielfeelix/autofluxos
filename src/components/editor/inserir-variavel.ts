/**
 * Insere texto na seleção atual de um campo.
 *
 * Mantém isto puro porque cursor é detalhe de navegador, mas a regra que decide
 * se troca uma seleção, acrescenta no fim ou corrige um cursor torto não deve
 * depender de DOM para ser conferida.
 */
export function inserirNoCursor(valor: string, inicio: number, fim: number, texto: string) {
  const de = Math.max(0, Math.min(inicio, valor.length))
  const ate = Math.max(de, Math.min(fim, valor.length))
  const proximo = valor.slice(0, de) + texto + valor.slice(ate)
  const cursor = de + texto.length

  return { proximo, cursor }
}
