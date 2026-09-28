/**
 * Os itens de uma variável que carrega lista.
 *
 * Separador `;` ou quebra de linha, que é o formato que sobrevive a `vars` ser
 * `Record<string, string>`. Guardar JSON numa string ali mentiria sobre o tipo;
 * separador não mente, só combina.
 */
export function itensDaLista(valor: string): string[] {
  return valor
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
}
