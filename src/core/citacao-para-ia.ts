/**
 * A resposta citada, escrita para a IA.
 *
 * No WhatsApp a pessoa toca numa mensagem antiga e responde em cima dela. O
 * texto que chega é só o que ela digitou agora, e a IA lia só isso: em
 * 02/out/2026 um cliente da PCYES citou o link de um produto e mandou ".", e o
 * bot perguntou do zero o que ele procurava. A citada já vem resolvida em
 * `lerConversa`; aqui ela só entra no texto, antes do que a pessoa escreveu.
 */

/** Quanto da citada entra. Um link ou uma frase cabem; um textão vira resumo. */
const LIMITE_DA_CITADA = 300

export function comCitacao(
  texto: string | null,
  cita: { texto: string | null; direcao?: 'entrada' | 'saida' } | undefined,
): string | null {
  const citada = cita?.texto?.trim()
  if (!citada) return texto
  const corte = citada.length > LIMITE_DA_CITADA ? `${citada.slice(0, LIMITE_DA_CITADA)}…` : citada
  const de = cita?.direcao === 'saida' ? 'a uma mensagem sua' : 'a uma mensagem anterior dele'
  return `(respondendo ${de}: "${corte}")\n${texto ?? ''}`.trim()
}
