/**
 * A formatação que o WhatsApp entende, aplicada na seleção.
 *
 * **Por que marcador e não editor rico.** O WhatsApp não recebe HTML: ele
 * recebe `*negrito*`, `_itálico_`, `~riscado~` e três crases para monoespaçado,
 * e renderiza sozinho. Guardar HTML no fluxo obrigaria a converter na saída e a
 * adivinhar na volta — e a conversão de volta é onde se perde texto. O que fica
 * gravado é exatamente o que sai.
 *
 * O que a barra resolve, então, não é o formato: é **lembrar a sintaxe**. Quem
 * escreve não precisa saber que itálico é sublinhado dos dois lados.
 */

/** Os quatro marcadores, no que a Meta documenta. */
export const MARCAS = {
  negrito: '*',
  italico: '_',
  riscado: '~',
  mono: '```',
} as const

export type Marca = keyof typeof MARCAS

/**
 * Envolve (ou desenvolve) a seleção.
 *
 * **É alternância, e isso importa mais do que parece.** Sem ela, clicar duas
 * vezes em negrito produz `**texto**`, que o WhatsApp mostra literalmente com
 * os asteriscos — o resultado é a pessoa achando que a barra está quebrada.
 * Reconhecer o que já está marcado e tirar é o que faz o botão se comportar
 * como botão.
 *
 * Sem seleção, ele insere o par vazio e devolve o cursor **entre** as duas
 * marcas, para quem clicou já sair digitando dentro.
 */
export function alternarMarca(
  valor: string,
  inicio: number,
  fim: number,
  marca: Marca,
): { proximo: string; selecaoInicio: number; selecaoFim: number } {
  const simbolo = MARCAS[marca]
  const de = Math.max(0, Math.min(inicio, valor.length))
  const ate = Math.max(de, Math.min(fim, valor.length))

  const selecionado = valor.slice(de, ate)
  const antes = valor.slice(0, de)
  const depois = valor.slice(ate)

  // Já marcado por dentro: "*texto*" selecionado inteiro.
  if (
    selecionado.length >= simbolo.length * 2 &&
    selecionado.startsWith(simbolo) &&
    selecionado.endsWith(simbolo)
  ) {
    const limpo = selecionado.slice(simbolo.length, selecionado.length - simbolo.length)
    return { proximo: antes + limpo + depois, selecaoInicio: de, selecaoFim: de + limpo.length }
  }

  // Já marcado por fora: "texto" selecionado e as marcas em volta da seleção.
  if (antes.endsWith(simbolo) && depois.startsWith(simbolo)) {
    const proximo =
      antes.slice(0, antes.length - simbolo.length) + selecionado + depois.slice(simbolo.length)
    const novoInicio = de - simbolo.length
    return { proximo, selecaoInicio: novoInicio, selecaoFim: novoInicio + selecionado.length }
  }

  const proximo = `${antes}${simbolo}${selecionado}${simbolo}${depois}`
  const dentro = de + simbolo.length
  return { proximo, selecaoInicio: dentro, selecaoFim: dentro + selecionado.length }
}
