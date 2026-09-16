/**
 * Os prazos do WhatsApp: até quando dá para responder, e quando isso é grátis.
 *
 * ---------------------------------------------------------------------------
 * São dois relógios, e eles não são o mesmo
 * ---------------------------------------------------------------------------
 *
 * **24h, contadas da última mensagem que a pessoa mandou.** É a janela de
 * atendimento. Dentro dela cabe texto livre, áudio, imagem, o que for. Fora
 * dela o único jeito de falar é um modelo aprovado, e o envio de texto volta
 * `(#131047) Re-engagement message`.
 *
 * **72h, contadas da chegada por anúncio.** Quem clica num anúncio Click to
 * WhatsApp ou no botão da Página do Facebook abre uma janela maior, e ela é
 * gratuita: a Meta não cobra nada do que for enviado dentro dela. É o que a
 * documentação chama de *free entry point conversation*.
 *
 * Os dois relógios convivem. A pessoa que chegou por anúncio na segunda e
 * escreveu de novo na quarta tem a janela do anúncio já vencida e a de 24h
 * aberta: dá para responder, e passa a custar. Por isso `restaDaJanela` devolve
 * o maior dos dois, e `dentroDaPortaDeEntrada` responde a pergunta do dinheiro
 * separadamente. Juntar as duas faria a tela dizer "grátis" no terceiro dia.
 *
 * ---------------------------------------------------------------------------
 * Como se sabe que a pessoa veio de anúncio
 * ---------------------------------------------------------------------------
 *
 * Não se adivinha, e não se deduz do texto. A mensagem que nasce de um clique
 * em anúncio chega no webhook com o objeto `referral` junto, e é só nela: a
 * segunda mensagem da mesma pessoa já vem sem. Quem chega por link `wa.me`,
 * por QR code ou por contato salvo na agenda vem sem `referral` e vale 24h,
 * mesmo que tenha visto o anúncio antes de salvar o número.
 *
 * Quem grava isso é `atribuirOrigem`, em `server/receber-mensagem.ts`, numa
 * linha da tabela `passagens`. É de lá que sai o `portaDeEntradaEm` daqui.
 *
 * ---------------------------------------------------------------------------
 *
 * Isso não é detalhe de API, é regra de produto: quem responde um lead pelo
 * painel precisa saber, antes de digitar, se a mensagem tem como chegar e se
 * ela vai custar. Sem isso a pessoa escreve um parágrafo, clica em enviar e
 * recebe um erro em inglês com um número entre parênteses.
 *
 * Está aqui, puro e sem rede, porque é uma conta sobre tempo, e conta sobre
 * tempo é o tipo de coisa que tem que dar para testar sem subir servidor.
 */

/** A janela de atendimento comum, contada da última mensagem da pessoa. */
export const JANELA_MS = 24 * 60 * 60 * 1000

/**
 * A janela de quem chegou por anúncio, contada do clique.
 *
 * Número separado de propósito, e não `JANELA_MS * 3`: são duas regras da Meta
 * que hoje por acaso têm essa proporção. Amarrá-las faria uma mudança lá virar
 * duas mudanças erradas aqui.
 */
export const JANELA_DA_PORTA_MS = 72 * 60 * 60 * 1000

/**
 * O que a conversa sabe sobre os próprios prazos.
 *
 * É objeto, e não dois argumentos soltos, porque os dois são data em texto e
 * trocar a ordem por engano não daria erro de tipo nenhum: daria uma janela
 * errada, calada, em produção.
 */
export type Janela = {
  /** Quando a pessoa escreveu pela última vez. `null` = nunca escreveu. */
  ultimaEntradaEm: string | null
  /**
   * Quando ela chegou por anúncio ou pelo botão da Página. `null` = não chegou
   * por lá, ou chegou tanto tempo atrás que não importa mais.
   */
  portaDeEntradaEm?: string | null
}

/** Quanto falta de um prazo, ou `null` se ele nunca começou. */
function restaDe(quando: string | null | undefined, duracao: number, agora: number): number | null {
  if (!quando) return null

  const inicio = Date.parse(quando)
  // Data ilegível no banco não pode virar "janela aberta". Falha fechado: o
  // erro barulhento é a tela dizer que não dá, não a Meta recusar no envio.
  if (Number.isNaN(inicio)) return null

  return Math.max(0, inicio + duracao - agora)
}

/**
 * Quanto tempo ainda dá para responder em texto livre.
 *
 * O maior dos dois prazos, porque qualquer um deles aberto já autoriza o envio.
 *
 * `null` quando nenhum dos dois existe: sem mensagem dela e sem chegada por
 * anúncio, não existe janela nenhuma aberta, nem uma que já fechou.
 */
export function restaDaJanela(janela: Janela, agora: number = Date.now()): number | null {
  const daConversa = restaDe(janela.ultimaEntradaEm, JANELA_MS, agora)
  const daPorta = restaDe(janela.portaDeEntradaEm, JANELA_DA_PORTA_MS, agora)

  if (daConversa === null) return daPorta
  if (daPorta === null) return daConversa
  return Math.max(daConversa, daPorta)
}

export function dentroDaJanela(janela: Janela, agora: number = Date.now()): boolean {
  const resta = restaDaJanela(janela, agora)
  return resta !== null && resta > 0
}

/**
 * Esta conversa ainda está dentro das 72h gratuitas do anúncio?
 *
 * Existe separado de `dentroDaJanela` porque responde outra pergunta: aquela é
 * sobre o que a Meta aceita entregar, esta é sobre o que ela cobra. Uma conversa
 * pode estar aberta e paga ao mesmo tempo, e é o caso mais comum.
 *
 * Vale notar o que ela **não** cobre: fora das 72h o preço passa a depender da
 * categoria do modelo enviado, e isso não é conta sobre tempo. Mora com o
 * contador de custo, não aqui.
 */
export function dentroDaPortaDeEntrada(janela: Janela, agora: number = Date.now()): boolean {
  const resta = restaDe(janela.portaDeEntradaEm, JANELA_DA_PORTA_MS, agora)
  return resta !== null && resta > 0
}

/**
 * O outro prazo da Meta: **reagir só vale para mensagem de até 30 dias.**
 *
 * É prazo diferente do de responder, conta de outro ponto e vale para os dois
 * lados da conversa: reagir ao que a pessoa mandou e ao que nós mandamos expira
 * igual. Por isso ele não reusa `JANELA_MS`.
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
