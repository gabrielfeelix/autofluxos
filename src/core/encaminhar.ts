/**
 * Encaminhar a pessoa para outro WhatsApp: o do suporte, o do comercial, o do
 * marketing.
 *
 * **Não existe transferir conversa entre números.** A conversa com a PCYES é
 * uma, a com o suporte é outra, e a Meta não move uma para dentro da outra.
 * O que dá para fazer, e é o que o atendente humano já fazia à mão, é dizer
 * "fala com eles neste número". Aqui isso vira três coisas numa mensagem só:
 * o texto, o botão que abre a conversa com o time **já com a mensagem
 * escrita**, e o cartão de contato para salvar.
 *
 * Puro: monta telefone e link, não manda nada. Quem manda é o canal.
 */

/** O `display_text` do botão `cta_url` aceita 20 caracteres. */
export const LIMITE_ROTULO_DO_ENCAMINHAMENTO = 20
/** Corpo do `cta_url`, igual ao do card de produto. */
export const LIMITE_TEXTO_DO_ENCAMINHAMENTO = 1024
/** A mensagem pronta vai na URL; mais que isso já não é "só completar". */
export const LIMITE_MENSAGEM_PRONTA = 500

export const ROTULO_PADRAO_DO_ENCAMINHAMENTO = 'Abrir conversa'

/**
 * Só os dígitos, com o 55 na frente quando a pessoa digitou o número do jeito
 * brasileiro: `(44) 2101-1428` vira `554421011428`.
 *
 * `null` quando não sobra um telefone: menos de 10 dígitos não é número de
 * ninguém, e mais de 15 passa do máximo do E.164. Nesse caso o bloco não
 * publica (ver `validar`), e o link quebrado nunca chega a sair.
 */
export function telefoneDoEncaminhamento(digitado: string): string | null {
  let digitos = digitado.replace(/\D/g, '')
  // "0 44 ..." de quem copia com o zero de longa distância.
  if (digitos.startsWith('0')) digitos = digitos.replace(/^0+/, '')
  // DDD + número (10 ou 11 dígitos) é brasileiro sem o país.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  if (digitos.length < 12 || digitos.length > 15) return null
  return digitos
}

/**
 * `(44) 2101-1428` para mostrar ao cliente, a partir dos dígitos com país.
 * Número de fora do Brasil sai como `+<dígitos>`, sem inventar máscara.
 */
export function telefoneLegivel(digitos: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${digitos}`
}

/**
 * O link que abre a conversa com o time, com a mensagem pronta na caixa de
 * texto. É o `wa.me` oficial: no celular abre o app, no computador abre o
 * WhatsApp Web, e a pessoa ainda revisa antes de enviar.
 */
export function linkDoEncaminhamento(digitos: string, mensagemPronta: string): string {
  const texto = mensagemPronta.trim()
  return texto ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : `https://wa.me/${digitos}`
}

/**
 * O mesmo encaminhamento em texto puro, para canal sem botão de link (chat do
 * site, Telegram, Instagram) ou quando o botão falha: o texto, o link e o
 * número escrito, para quem prefere discar.
 */
export function encaminhamentoEmTexto(e: { texto: string; rotulo: string; link: string; nome: string; telefone: string }): string {
  return [e.texto.trim(), `${e.rotulo}: ${e.link}`, `${e.nome}: ${telefoneLegivel(e.telefone)}`].filter(Boolean).join('\n\n')
}
