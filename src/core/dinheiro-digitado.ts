/**
 * O texto de um campo de dinheiro enquanto a pessoa digita, no formato
 * brasileiro: milhar com ponto, centavos depois da vírgula, no máximo dois.
 * "1500" vira "1.500", "1500,5" vira "1.500,5". O resultado é o que o
 * `lerValor` (core/crm.ts) já lê, então nada muda do lado do servidor.
 *
 * Colado de outro lugar, "1500.50" (ponto decimal, sem vírgula) vira
 * "1.500,50": ponto seguido de um ou dois dígitos no fim é centavo.
 */
export function formatarDinheiroDigitado(bruto: string): string {
  let texto = bruto.replace(/[^\d.,]/g, '')
  if (!texto.includes(',') && /\.\d{1,2}$/.test(texto)) {
    const i = texto.lastIndexOf('.')
    texto = `${texto.slice(0, i)},${texto.slice(i + 1)}`
  }
  const virgula = texto.indexOf(',')
  const inteiro = (virgula === -1 ? texto : texto.slice(0, virgula)).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const centavos = virgula === -1 ? null : texto.slice(virgula + 1).replace(/\D/g, '').slice(0, 2)
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (centavos === null) return comMilhar
  return `${comMilhar === '' ? '0' : comMilhar},${centavos}`
}

/** Quantos caracteres que importam (dígitos e a vírgula) há antes da posição. */
export function significativosAntes(texto: string, posicao: number): number {
  return texto.slice(0, posicao).replace(/[^\d,]/g, '').length
}

/** A posição, no texto formatado, depois de `n` caracteres que importam. */
export function posicaoDepois(texto: string, n: number): number {
  if (n <= 0) return 0
  let vistos = 0
  for (let i = 0; i < texto.length; i++) {
    if (/[\d,]/.test(texto.charAt(i))) vistos++
    if (vistos === n) return i + 1
  }
  return texto.length
}
