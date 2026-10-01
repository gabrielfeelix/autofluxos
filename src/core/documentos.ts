/**
 * CPF e CNPJ com o dígito verificador conferido de verdade.
 *
 * Moram aqui, e não no motor, porque dois lugares pedem os mesmos números: a
 * pergunta do fluxo (`flow/resposta.ts`) e o formulário do chat do site. O
 * balão (`public/chat/v1.js`) tem uma cópia em JavaScript puro, porque ele não
 * importa nada deste repositório; as duas precisam continuar iguais.
 */

/** Onze dígitos com verificador certo, ou `null`. */
export function cpfValido(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 11) return null
  // `111.111.111-11` passa em qualquer conta de verificador, e é o erro de
  // digitação mais comum de todos.
  if (/^(\d)\1{10}$/.test(digitos)) return null

  for (const [ate, peso] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(digitos[i]) * (peso - i)
    const resto = (soma * 10) % 11
    if ((resto === 10 ? 0 : resto) !== Number(digitos[ate])) return null
  }

  return digitos
}

/** Catorze dígitos com verificador certo, ou `null`. */
export function cnpjValido(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 14) return null
  if (/^(\d)\1{13}$/.test(digitos)) return null

  for (const ate of [12, 13]) {
    // Pesos de 2 a 9 da direita para a esquerda, recomeçando em 2.
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(digitos[i]) * (((ate - 1 - i) % 8) + 2)
    const resto = soma % 11
    if ((resto < 2 ? 0 : 11 - resto) !== Number(digitos[ate])) return null
  }

  return digitos
}
