/**
 * O id que a Meta dá ao contato do WhatsApp quando o telefone não vem.
 *
 * Com os nomes de usuário do WhatsApp (2026), quem adota um some com o
 * telefone dos webhooks, a menos que o número da conta tenha falado com ele nos
 * últimos 30 dias. No lugar vem o BSUID: o código do país, um ponto e até 128
 * letras e dígitos (`BR.13491208655302741918`). O BSUID "principal", de quem
 * tem vários portfólios, tem `ENT` no meio (`BR.ENT.1181...`).
 *
 * Nesse caso o BSUID vai para `contacts.wa_id`, que é o endereço de envio (no
 * Instagram ele já guarda o IGSID), e é por esta função que o resto do sistema
 * sabe que ali não há um telefone. Ver a migration `0098`.
 */
const FORMATO = /^[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}$/

export function ehBsuid(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && FORMATO.test(valor)
}
