/**
 * Contar texto do jeito que a Meta conta, e não do jeito que o JavaScript conta.
 *
 * `"📅".length` é **2**: o JavaScript mede unidades UTF-16, e emoji fora do
 * plano básico ocupa um par substituto. A Cloud API conta **caracteres**, então
 * `📅` + 19 letras é um rótulo de 20 que ela aceita — e que `.length` reprovava
 * com 21.
 *
 * O erro não era só de contagem. O campo de opção usava `maxLength={20}` do
 * HTML, que também conta UTF-16, e isso produziu três defeitos de uma vez, todos
 * relatados por quem estava usando:
 *
 * 1. **Rótulo com 19 letras recusava qualquer emoji** — o navegador simplesmente
 *    não deixava digitar, sem dizer por quê.
 * 2. **Colar texto longo cortava no meio do par substituto**, deixando um
 *    substituto solto (`"...\ud83d"`) na string.
 * 3. **Esse substituto solto derruba o salvamento**: `JSON.stringify` o emite
 *    como `\ud83d` e o Postgres recusa a sequência dentro de `jsonb`. O
 *    rascunho não gravava, e ao recarregar a opção e os emojis tinham sumido —
 *    que foi exatamente o sintoma relatado.
 *
 * Por isso a regra deste arquivo: **conte por caractere, corte por caractere, e
 * nunca deixe meio caractere passar.**
 */

/** Quantos caracteres a Meta veria. `"📅 oi"` → 4, e não 5. */
export function contarCaracteres(texto: string): number {
  return [...texto].length
}

/**
 * Corta preservando o caractere inteiro.
 *
 * `"...📅".slice(0, 20)` pode devolver meio emoji; isto nunca devolve.
 */
export function cortarCaracteres(texto: string, limite: number): string {
  const letras = [...texto]
  return letras.length <= limite ? texto : letras.slice(0, limite).join('')
}

/**
 * Tem meio caractere aqui dentro?
 *
 * Um substituto sem par não é texto válido: ele sobrevive na memória do
 * navegador, atravessa o `JSON.stringify`, e só estoura lá no banco — longe de
 * quem digitou. Esta função é o que permite recusar antes.
 */
export function temMetadeDeCaractere(texto: string): boolean {
  // A flag `u` faz o motor casar por ponto de código; um substituto solto é o
  // único jeito de `\p{Surrogate}` casar depois disso.
  return /\p{Surrogate}/u.test(texto)
}

/** Tira substituto solto, se houver. Usado antes de gravar, nunca antes de ler. */
export function semMetadeDeCaractere(texto: string): string {
  return texto.replace(/\p{Surrogate}/gu, '')
}
