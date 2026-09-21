/**
 * As regras de marcar uma mensagem para depois.
 *
 * ---------------------------------------------------------------------------
 * A janela de 24h é o problema de verdade, e ela precisa estar na tela
 * ---------------------------------------------------------------------------
 *
 * O WhatsApp só aceita texto livre até 24h depois da última mensagem do
 * cliente. Uma mensagem marcada para amanhã de manhã quase sempre cai **fora**
 * dessa janela, e a Meta recusa, exige modelo aprovado, que este produto ainda
 * não tem.
 *
 * Um agendador que aceita calado e falha de madrugada é pior do que não ter
 * agendador: quem marcou achou que estava resolvido. Por isso o aviso é
 * calculado aqui, aparece **antes** de marcar, e a recusa fica guardada em
 * `mensagens_agendadas.erro` quando acontece mesmo assim.
 *
 * ---------------------------------------------------------------------------
 * Os horários são do relógio de quem marca
 * ---------------------------------------------------------------------------
 *
 * "Amanhã de manhã" é uma frase sobre o relógio de quem está olhando a tela,
 * não sobre o fuso do servidor nem sobre o horário de atendimento da conta.
 * Estas funções rodam no navegador, com a data local, e o que viaja para o
 * servidor é um instante absoluto, a partir dali não há fuso nenhum para
 * errar.
 */

/** O teto do texto, o mesmo da caixa de resposta: é a regra da Meta. */
export const LIMITE_DO_TEXTO = 4096

/**
 * Quanto no futuro dá para marcar.
 *
 * Um ano não é generosidade: é o ponto em que o número deixa de ser um engano
 * de digitação. Quem erra o ano no campo de data marcava para 2126 e a linha
 * ficava na fila para sempre.
 */
export const TETO_DO_AGENDAMENTO_MS = 365 * 24 * 60 * 60 * 1000

/**
 * O mínimo à frente.
 *
 * Um minuto. Marcar para "agora" é mandar agora, e para isso existe o botão de
 * enviar, aceitar aqui criaria um caminho mais lento para o mesmo gesto, com
 * uma passada de fila no meio.
 */
export const MINIMO_A_FRENTE_MS = 60 * 1000

export type Predefinicao =
  | 'em_1h'
  | 'em_3h'
  | 'amanha_manha'
  | 'amanha_tarde'
  | 'proxima_segunda'

export const PREDEFINICOES: { chave: Predefinicao; rotulo: string }[] = [
  { chave: 'em_1h', rotulo: 'Em 1 hora' },
  { chave: 'em_3h', rotulo: 'Em 3 horas' },
  { chave: 'amanha_manha', rotulo: 'Amanhã de manhã' },
  { chave: 'amanha_tarde', rotulo: 'Amanhã à tarde' },
  { chave: 'proxima_segunda', rotulo: 'Próxima segunda' },
]

/** 9h e 14h: o começo do expediente e o começo da tarde, sem inventar precisão. */
const MANHA = 9
const TARDE = 14

export function quandoDaPredefinicao(chave: Predefinicao, agora: Date = new Date()): Date {
  const alvo = new Date(agora)

  switch (chave) {
    case 'em_1h':
      alvo.setTime(alvo.getTime() + 60 * 60 * 1000)
      return alvo
    case 'em_3h':
      alvo.setTime(alvo.getTime() + 3 * 60 * 60 * 1000)
      return alvo
    case 'amanha_manha':
      alvo.setDate(alvo.getDate() + 1)
      alvo.setHours(MANHA, 0, 0, 0)
      return alvo
    case 'amanha_tarde':
      alvo.setDate(alvo.getDate() + 1)
      alvo.setHours(TARDE, 0, 0, 0)
      return alvo
    case 'proxima_segunda': {
      /*
       * A **próxima** segunda, e nunca hoje.
       *
       * Segunda-feira de manhã, "próxima segunda" significando daqui a algumas
       * horas seria uma armadilha: quem escolhe essa opção está empurrando para
       * a semana que vem. O `|| 7` é o que transforma "faltam 0 dias" em "falta
       * uma semana".
       */
      const faltam = (8 - alvo.getDay()) % 7 || 7
      alvo.setDate(alvo.getDate() + faltam)
      alvo.setHours(MANHA, 0, 0, 0)
      return alvo
    }
  }
}

/**
 * O valor para um `<input type="datetime-local">`, que não aceita fuso.
 *
 * `toISOString()` devolveria UTC e o campo mostraria três horas a menos ,
 * errado de um jeito que parece certo, que é o pior tipo de erro de data.
 */
export function paraCampoLocal(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`
}

export type RecusaDoAgendamento =
  | 'sem_texto'
  | 'texto_longo'
  | 'sem_data'
  | 'passado'
  | 'longe_demais'

/** `null` = pode marcar. */
export function conferirAgendamento(
  entrada: { texto: string; quando: Date | null },
  agora: Date = new Date(),
): RecusaDoAgendamento | null {
  const texto = entrada.texto.trim()
  if (texto === '') return 'sem_texto'
  if (texto.length > LIMITE_DO_TEXTO) return 'texto_longo'

  const quando = entrada.quando
  if (!quando || Number.isNaN(quando.getTime())) return 'sem_data'

  const daqui = quando.getTime() - agora.getTime()
  if (daqui < MINIMO_A_FRENTE_MS) return 'passado'
  if (daqui > TETO_DO_AGENDAMENTO_MS) return 'longe_demais'

  return null
}

export const MOTIVO_DA_RECUSA: Record<RecusaDoAgendamento, string> = {
  sem_texto: 'escreva a mensagem antes de marcar',
  texto_longo: `o WhatsApp aceita até ${LIMITE_DO_TEXTO.toLocaleString('pt-BR')} caracteres`,
  sem_data: 'escolha quando mandar',
  passado: 'escolha um horário à frente, para mandar agora, use o botão de enviar',
  longe_demais: 'isso está a mais de um ano daqui; confira o ano que você digitou',
}

/**
 * O horário escolhido já se sabe fora da janela de 24h?
 *
 * `fimDaJanela` é o instante em que ela fecha, ou `null` quando ela já está
 * fechada (e aí nem existe caixa de resposta). "Já se sabe" é a palavra que
 * importa: a janela **reabre** a cada mensagem que o cliente manda, então isto
 * é um aviso e não uma recusa. Bloquear seria errado, a pessoa pode estar
 * marcando justamente uma resposta para depois de uma conversa que vai
 * continuar.
 */
export function foraDaJanela(quando: Date | null, fimDaJanela: string | null): boolean {
  if (!quando || Number.isNaN(quando.getTime())) return false
  if (!fimDaJanela) return true
  return quando.getTime() > new Date(fimDaJanela).getTime()
}
