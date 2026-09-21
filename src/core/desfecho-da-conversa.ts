/**
 * O que aconteceu com uma conversa, e de quem é o mérito ou a culpa.
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, e por que ele é o ponto da T8.2
 * ---------------------------------------------------------------------------
 *
 * O painel dizia "o bot resolveu 26% das conversas" a partir de uma conta com
 * três problemas, e os três empurravam o número para lados diferentes:
 *
 * 1. **toda transferência era igual.** Um fluxo que termina em "falar com
 *    atendente" porque é isso que ele foi desenhado para fazer, e uma conversa
 *    que caiu no colo de alguém porque a integração falhou, contavam a mesma
 *    coisa. O primeiro é o produto funcionando; o segundo é defeito. Juntos, o
 *    número não responde nem "o bot está bom?" nem "o que está quebrado?";
 * 2. **conversa atendida por pessoa sumia da conta.** `acumular` somava
 *    `encerrada` e `humano` e ignorava `atendida_por_pessoa`, que é quem passou
 *    por gente e terminou. Ela entrava no total e em nenhuma fatia, então as
 *    partes não fechavam com o todo e ninguém percebia;
 * 3. **`esperandoPessoa` contava quem espera AGORA.** Comparar "conversas do
 *    mês" com "esperando neste instante" é somar um estoque a um fluxo: no dia
 *    1º do mês o número é sempre quase zero, e ele não mede o mês nenhum.
 *
 * A RB-06 é o que amarra os três: "o bot resolveu 26%" afirma um fato sobre os
 * outros 74%, e afirmar isso sem saber é o que esta tarefa veio impedir.
 *
 * Puro, sem banco e sem React, como `core/relacionamento.ts`.
 */

// ---------------------------------------------------------------------------
// 1. De onde veio a transferência
// ---------------------------------------------------------------------------

/**
 * Por que o bot parou e chamou gente.
 *
 * São duas, e a diferença é **de quem foi a decisão**:
 *
 * - `prevista`: o desenho do fluxo mandou transferir. É o bloco "transferir
 *   para humano", posto ali por quem montou o fluxo. Não é falha nenhuma: numa
 *   clínica, "quero remarcar" indo para a recepção é o produto funcionando;
 * - `falha`: o bot não conseguiu seguir. A entrega da mensagem falhou, o fluxo
 *   pediu IA e não havia modelo, a integração não executou, a conversa travou.
 *   Ninguém desenhou isso, e cada uma destas é um conserto possível.
 *
 * Esta é a lista fechada que a 0086 grava em `handoffs.origem`. Antes dela só
 * havia `motivo`, texto livre escrito para gente ler, e classificar por
 * palavra-chave seria adivinhar: "a integração não chegou a ser executada" e
 * "o cliente pediu para falar com a integração" casariam no mesmo `like`.
 */
export const ORIGENS_DE_HANDOFF = ['prevista', 'falha'] as const

export type OrigemDoHandoff = (typeof ORIGENS_DE_HANDOFF)[number]

/**
 * Como a transferência é **escrita para quem paga pelo produto**.
 *
 * O nome interno continua `falha`, porque é o que o banco grava e o que o time
 * precisa procurar. O rótulo, não: "transferência por falha" na tela do cliente
 * é o produto se acusando em público, sem dizer falha de quê nem o que fazer a
 * respeito. O que aconteceu, de fato, é que a conversa parou por um erro
 * técnico e alguém da equipe assumiu.
 */
export const ROTULO_DA_ORIGEM: Record<OrigemDoHandoff, string> = {
  prevista: 'Passada para a equipe',
  falha: 'Interrompida por um erro',
}

// ---------------------------------------------------------------------------
// 2. Como a conversa terminou
// ---------------------------------------------------------------------------

/**
 * Os quatro desfechos possíveis de uma conversa, e eles **somam o total**.
 *
 * Que eles somem é a propriedade inteira: um painel cujas fatias não fecham com
 * o todo é um painel que ninguém consegue conferir, e a primeira vez que alguém
 * tenta somar as colunas e não bate, a tela perde a credibilidade toda.
 */
export const DESFECHOS = ['bot', 'prevista', 'falha', 'aberta'] as const

export type Desfecho = (typeof DESFECHOS)[number]

export const ROTULO_DO_DESFECHO: Record<Desfecho, string> = {
  bot: 'Resolvida pela automação',
  prevista: 'Atendida pela equipe',
  falha: 'Interrompida por um erro',
  aberta: 'Ainda em aberto',
}

export type ContagemPorDesfecho = Record<Desfecho, number>

export const SEM_CONVERSAS: ContagemPorDesfecho = { bot: 0, prevista: 0, falha: 0, aberta: 0 }

/**
 * Uma conversa como o banco a descreve, reduzida ao que decide o desfecho.
 */
export type FatosDaConversa = {
  /**
   * O que a view já classifica: `encerrada`, `humano`, `atendida_por_pessoa`,
   * `ativa`, ou o que vier a existir.
   */
  status: string
  /**
   * De onde veio a transferência, se houve alguma. `null` = não houve handoff.
   *
   * **`undefined` é diferente de `null`**, e a diferença importa: `null` é
   * "sabidamente não houve transferência", e `undefined` é "não se sabe", que é
   * o caso dos handoffs gravados antes da 0086. Ver `desfechoDe`.
   */
  origem?: OrigemDoHandoff | null
}

/**
 * Em que fatia esta conversa cai.
 *
 * **Só entra em `falha` o que o motor marcou como falha.** Era o contrário: a
 * fatia começava com tudo que não fosse `prevista`, e engolia dois casos que
 * não são erro nenhum:
 *
 * - **a conversa que uma pessoa assumiu pelo Inbox.** Não há handoff, a origem
 *   é `null`, e a equipe decidiu atender. Chamar isso de falha é acusar o
 *   produto de um defeito que não houve;
 * - **o handoff anterior à 0086**, que não tem a coluna. Em produção eles são
 *   oito, e metade diz "a pessoa pediu atendente" e "pedido pelo fluxo", que é
 *   o desenho funcionando.
 *
 * Foi assim que a conta de um cliente real mostrou 64% de "transferidas por
 * falha" num mês em que o produto não tinha 64% de defeito nenhum. Número
 * errado, e escrito da pior forma possível: a tela acusava o próprio produto na
 * frente de quem paga por ele.
 *
 * O erro que sobra é o barato e o temporário: um handoff legado que era defeito
 * de verdade aparece como atendimento da equipe. A partir da 0086 toda
 * transferência grava a origem, então isso só encolhe, e o defeito continua
 * legível no motivo de cada conversa.
 */
export function desfechoDe(conversa: FatosDaConversa): Desfecho {
  if (conversa.status === 'encerrada') return 'bot'

  // Passou por gente: é transferência, e o que decide a fatia é a origem.
  if (conversa.status === 'humano' || conversa.status === 'atendida_por_pessoa') {
    return conversa.origem === 'falha' ? 'falha' : 'prevista'
  }

  // `ativa`, e qualquer status que venha a existir: a conversa não terminou, e
  // contá-la como resolvida por quem quer que seja é afirmar um desfecho que
  // ainda não aconteceu.
  return 'aberta'
}

/**
 * A taxa de automação: quanto o bot resolveu **sozinho, do que terminou**.
 *
 * ---------------------------------------------------------------------------
 * Por que o denominador exclui as conversas em aberto
 * ---------------------------------------------------------------------------
 *
 * Dividir por tudo faria a taxa cair todo começo de mês pelo simples fato de
 * haver conversa em andamento, e subir sozinha no fim, sem ninguém ter mexido
 * em nada. O dono veria a automação "piorando" toda primeira semana.
 *
 * `null` quando nada terminou. **Não é zero**: zero seria "terminaram, e o bot
 * não resolveu nenhuma", que é um mês ruim de verdade, e mostrar um no lugar do
 * outro faz uma conta nova parecer uma conta quebrada (RB-06).
 */
export function taxaDeAutomacao(c: ContagemPorDesfecho): number | null {
  const terminadas = c.bot + c.prevista + c.falha
  if (terminadas === 0) return null
  return Math.round((c.bot / terminadas) * 100)
}

/**
 * Quanto do que terminou parou por um erro técnico.
 *
 * É o número que gera trabalho de engenharia, e por isso ele é separado do
 * anterior em vez de ser o complemento dele: `100 - taxaDeAutomacao` juntaria
 * de volta a transferência prevista, que não é para consertar.
 */
export function taxaDeFalha(c: ContagemPorDesfecho): number | null {
  const terminadas = c.bot + c.prevista + c.falha
  if (terminadas === 0) return null
  return Math.round((c.falha / terminadas) * 100)
}

/** Quantas conversas terminaram, de qualquer jeito. O denominador das taxas. */
export function terminadas(c: ContagemPorDesfecho): number {
  return c.bot + c.prevista + c.falha
}

/** O total, inclusive as que ainda estão acontecendo. */
export function total(c: ContagemPorDesfecho): number {
  return terminadas(c) + c.aberta
}
