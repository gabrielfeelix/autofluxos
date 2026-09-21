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
 * ---------------------------------------------------------------------------
 * As 72h são de **cobrança**, não de autorização. Isto já esteve errado aqui.
 * ---------------------------------------------------------------------------
 *
 * `restaDaJanela` devolvia o **maior dos dois** prazos, e a consequência era
 * concreta: quem clicou no anúncio e nunca escreveu aparecia com janela aberta
 * por três dias. A tela abria o compositor, a pessoa escrevia um parágrafo,
 * clicava em enviar, e a Meta respondia `(#131047) Re-engagement message`.
 *
 * A dúvida que a proposta de 19/set registrou na RB-13 ("Existe divergência nas
 * fontes consultadas sobre mensagem livre dentro da janela gratuita de entrada")
 * está resolvida, com fonte primária: **as 72h valem para cobrança, não para
 * texto livre.** Quem autoriza texto livre é a janela de 24h da última mensagem
 * **da pessoa**. Uma entrada gratuita sem resposta dela não abre conversa: abre
 * o direito de responder de graça *quando* ela responder.
 *
 * Por isso os dois relógios deixaram de ser comparados. `restaDaJanela` conta só
 * as 24h, e `dentroDaPortaDeEntrada` responde a pergunta do dinheiro,
 * separadamente. É a RB-13: "Separar o cálculo de cobrança do cálculo de envio;
 * fora da permissão confirmada, oferecer modelo aprovado quando elegível".
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
 * **Só as 24h da última mensagem da pessoa.** Ver o cabeçalho: a janela de 72h
 * do anúncio é gratuidade, não autorização, e misturar as duas fazia a tela
 * abrir o compositor para quem clicou num anúncio e nunca escreveu.
 *
 * `null` quando ela nunca escreveu: não existe janela aberta, nem uma que já
 * fechou. Quem chegou por anúncio e ainda não falou cai aqui, e é o certo, o
 * caminho dele é modelo aprovado, e o envio sai de graça por causa da porta.
 */
export function restaDaJanela(janela: Janela, agora: number = Date.now()): number | null {
  return restaDe(janela.ultimaEntradaEm, JANELA_MS, agora)
}

/**
 * O que a tela precisa saber antes de a pessoa digitar, em uma resposta só.
 *
 * ---------------------------------------------------------------------------
 * Por que objeto, e não três chamadas soltas
 * ---------------------------------------------------------------------------
 *
 * Porque as três perguntas são diferentes e a tela erra quando trata uma como
 * resposta da outra, foi exatamente assim que as 72h viraram autorização de
 * texto livre. A proposta pede as três separadas, em 5.3: origem, permissão de
 * envio, e benefício de cobrança.
 *
 * `desconhecido` é valor de verdade, e não um `false` disfarçado. Não saber se a
 * conversa é gratuita não é o mesmo que saber que ela é paga, e a tela deve
 * dizer "Não confirmado" em vez de inventar um dos dois: a RB-08 manda mostrar
 * campo indisponível como "Não identificado", e a 5.3 traz "Não confirmado" para
 * a linha da cobrança.
 */
export type PermissaoDeEnvio = {
  /** Texto livre é aceito agora? Só a janela de 24h responde isto. */
  textoLivre: boolean
  /** Quanto falta das 24h, ou `null` se ela nunca escreveu. */
  restanteMs: number | null
  /**
   * Por que o texto livre não é aceito. `null` quando ele é.
   *
   * Existe para a tela explicar em vez de só desabilitar um botão: "ela nunca
   * escreveu" e "faz mais de 24h" levam a ações diferentes de quem atende.
   */
  causa: 'nunca_escreveu' | 'janela_fechada' | null
  /** O envio sai de graça? `desconhecido` quando não dá para afirmar. */
  cobranca: 'gratuita' | 'paga' | 'desconhecido'
}

export function permissaoDeEnvio(janela: Janela, agora: number = Date.now()): PermissaoDeEnvio {
  const restanteMs = restaDaJanela(janela, agora)
  const textoLivre = restanteMs !== null && restanteMs > 0

  const causa = textoLivre
    ? null
    : janela.ultimaEntradaEm
      ? ('janela_fechada' as const)
      : ('nunca_escreveu' as const)

  /*
   * A cobrança é outra conta, e por isso outro campo.
   *
   * Dentro das 72h da porta, a Meta não cobra. Fora delas o preço passa a
   * depender da categoria do modelo enviado, e isso não é conta sobre tempo:
   * daí `desconhecido` para quem nunca veio por anúncio, em vez de `paga`.
   * Afirmar "paga" aqui seria a tela prometendo um custo que ela não calculou.
   */
  const cobranca = dentroDaPortaDeEntrada(janela, agora)
    ? ('gratuita' as const)
    : janela.portaDeEntradaEm
      ? ('paga' as const)
      : ('desconhecido' as const)

  return { textoLivre, restanteMs, causa, cobranca }
}

/**
 * Dá para mandar texto livre agora?
 *
 * Atalho de `permissaoDeEnvio().textoLivre`, mantido porque é a pergunta de
 * dez chamadores e um booleano lê melhor num `if`. Quem precisa explicar **por
 * que** não dá, ou dizer se sai de graça, usa `permissaoDeEnvio`.
 */
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
