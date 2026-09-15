/**
 * A janela de 24 horas do WhatsApp.
 *
 * A Meta só deixa mandar texto livre para alguém dentro de 24h contadas a
 * partir da **última mensagem que a pessoa mandou**. Passou disso, o único
 * jeito de falar é um modelo (template) aprovado, e o envio de texto volta
 * `(#131047) Re-engagement message`.
 *
 * Isso não é detalhe de API, é regra de produto: quem responde um lead pelo
 * painel precisa saber, antes de digitar, se a mensagem tem como chegar. Sem
 * isso a pessoa escreve um parágrafo, clica em enviar e recebe um erro em
 * inglês com um número entre parênteses.
 *
 * Está aqui, puro e sem rede, porque é uma conta sobre tempo — e conta sobre
 * tempo é o tipo de coisa que tem que dar para testar sem subir servidor.
 */

export const JANELA_MS = 24 * 60 * 60 * 1000

/**
 * Quanto tempo ainda dá para responder em texto livre.
 *
 * `null` quando a pessoa nunca escreveu: sem mensagem dela, não existe janela
 * nenhuma aberta — nem uma que já fechou.
 */
export function restaDaJanela(
  ultimaEntradaEm: string | null,
  agora: number = Date.now(),
): number | null {
  if (!ultimaEntradaEm) return null

  const inicio = Date.parse(ultimaEntradaEm)
  // Data ilegível no banco não pode virar "janela aberta". Falha fechado: o
  // erro barulhento é a tela dizer que não dá, não a Meta recusar no envio.
  if (Number.isNaN(inicio)) return null

  return Math.max(0, inicio + JANELA_MS - agora)
}

export function dentroDaJanela(ultimaEntradaEm: string | null, agora: number = Date.now()): boolean {
  const resta = restaDaJanela(ultimaEntradaEm, agora)
  return resta !== null && resta > 0
}

/**
 * O outro prazo da Meta: **reagir só vale para mensagem de até 30 dias.**
 *
 * É prazo diferente do de responder, conta de outro ponto e vale para os dois
 * lados da conversa — reagir ao que a pessoa mandou e ao que nós mandamos
 * expira igual. Por isso ele não reusa `JANELA_MS`: são duas regras da Meta
 * que por acaso são ambas sobre tempo, e amarrá-las faria uma mudança lá
 * mexer na outra aqui.
 *
 * Existe para a tela **esconder o botão** em vez de deixar a Meta recusar. Um
 * botão de reagir que some sem explicação vira chamado de suporte; um que não
 * aparece numa mensagem de março não é notado por ninguém.
 */
export const PRAZO_DE_REACAO_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Ainda dá para reagir a esta mensagem?
 *
 * Data ilegível responde `false` pelo mesmo motivo de `restaDaJanela`: falhar
 * fechado é a tela não oferecer, e não a Meta recusar depois do clique.
 */
export function podeReagir(tsDaMensagem: string, agora: number = Date.now()): boolean {
  const quando = Date.parse(tsDaMensagem)
  if (Number.isNaN(quando)) return false
  return agora - quando < PRAZO_DE_REACAO_MS
}

/** "faltam 3h" / "faltam 12min". Para a tela avisar antes de a pessoa digitar. */
export function comoFalta(restanteMs: number): string {
  const minutos = Math.floor(restanteMs / 60_000)
  if (minutos < 60) return `${Math.max(1, minutos)}min`

  const horas = Math.floor(minutos / 60)
  const sobra = minutos % 60
  return sobra === 0 ? `${horas}h` : `${horas}h${String(sobra).padStart(2, '0')}`
}
