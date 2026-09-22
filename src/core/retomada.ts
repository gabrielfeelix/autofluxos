/**
 * Quando uma conversa parada em atendimento humano volta ao bot.
 *
 * ---------------------------------------------------------------------------
 * O defeito que isto existe para consertar
 * ---------------------------------------------------------------------------
 *
 * Uma sessão em `humano` cala o bot ali para sempre: `avancarConversa` vincula
 * a mensagem e retorna, sem executar nada. A única saída é alguém clicar em
 * "Religar o bot nesta conversa", e ninguém clica. Em 22/set/2026 havia quatro
 * conversas presas em produção, a mais velha de 03/set, todas com gente do
 * outro lado escrevendo e nada respondendo. Não dá erro, não entra em alerta,
 * não aparece em lugar nenhum: some.
 *
 * ---------------------------------------------------------------------------
 * Por que a conta pura mora aqui
 * ---------------------------------------------------------------------------
 *
 * A decisão tem quatro entradas (interruptor da conta, prazo da conta, prazo do
 * bloco, última fala da equipe) e nenhuma delas precisa de banco. Separada, ela
 * é testável sem subir nada e é o único lugar em que a regra existe escrita.
 */

/** O padrão que a tela sugere e que vale quando a conta não escreveu nada. */
export const MENSAGEM_DE_RETOMADA_PADRAO =
  'Por aqui o atendimento seguiu sozinho, e voltei a te atender. ' +
  'A equipe já foi avisada e pode entrar na conversa a qualquer momento.'

/** Quanto tempo a conta nova espera, em minutos. */
export const MINUTOS_DE_RETOMADA_PADRAO = 120

/**
 * O teto, e é o mesmo do `timeoutMinutos` da pergunta: a janela do WhatsApp.
 *
 * Passadas as 24h da última mensagem dela, não há como mandar texto livre. Um
 * prazo maior que a janela venceria sempre sem poder avisar ninguém.
 */
export const MINUTOS_DE_RETOMADA_TETO = 1_440

export type ConfigDaConta = {
  ativo: boolean
  minutos: number
  mensagem: string | null
}

/**
 * O que o bloco de handoff escolheu.
 *
 * `undefined` é "usa o da conta" e é o que todo grafo publicado antes deste
 * campo tem. `'nunca'` é escolha explícita de não voltar, para o caminho que
 * não pode ser interrompido.
 */
export type EscolhaDoBloco = number | 'nunca' | undefined

export type Decisao =
  | { o: 'desligado' }
  | { o: 'retomar' }
  | { o: 'esperar'; faltamMs: number }

/**
 * Quantos minutos valem para esta conversa, ou `null` quando ela nunca volta.
 *
 * A ordem é bloco, depois conta, e o interruptor da conta vence os dois: quem
 * desligou o recurso desligou o recurso, e um prazo escrito num bloco meses
 * atrás não pode religá-lo pelas costas.
 */
export function minutosDaRetomada(conta: ConfigDaConta, bloco: EscolhaDoBloco): number | null {
  if (!conta.ativo) return null
  if (bloco === 'nunca') return null
  const minutos = bloco ?? conta.minutos
  if (!Number.isFinite(minutos) || minutos < 1) return null
  return Math.min(minutos, MINUTOS_DE_RETOMADA_TETO)
}

/**
 * Já passou da hora?
 *
 * **`desde` é a última fala da equipe, não o começo do atendimento.** É a regra
 * que separa um recurso que ajuda de um que atrapalha: quem está respondendo
 * agora nunca pode ser interrompido no meio. Quando a equipe nunca falou, quem
 * conta é o momento em que a conversa virou `humano`, que é exatamente o caso
 * do handoff que ninguém viu.
 *
 * **Mensagem do contato não conta.** Ela é o sintoma, não o atendimento: pessoa
 * escrevendo e ninguém respondendo é o que o prazo existe para resolver.
 */
export function decidirRetomada(
  conta: ConfigDaConta,
  bloco: EscolhaDoBloco,
  desde: Date,
  agora: Date = new Date(),
): Decisao {
  const minutos = minutosDaRetomada(conta, bloco)
  if (minutos === null) return { o: 'desligado' }

  const faltamMs = desde.getTime() + minutos * 60_000 - agora.getTime()
  return faltamMs <= 0 ? { o: 'retomar' } : { o: 'esperar', faltamMs }
}

/** O texto que sai, na ordem bloco, conta, padrão. */
export function mensagemDaRetomada(
  conta: ConfigDaConta,
  doBloco: string | undefined,
): string {
  const escolhido = (doBloco ?? conta.mensagem ?? '').trim()
  return escolhido === '' ? MENSAGEM_DE_RETOMADA_PADRAO : escolhido
}
