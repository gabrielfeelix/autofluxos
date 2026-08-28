/**
 * As datas que todo fluxo tem de graça — e a peça que faltava para "semana que
 * vem" funcionar sem IA.
 *
 * **O problema, escrito por quem opera:** *"'esta semana', 'semana que vem' — o
 * sistema identificar quando é e sugerir as disponibilidades"*. Um bloco de
 * pergunta com formato `data` exige `21/08/2026`, com ano de quatro dígitos e
 * por um bom motivo (quem escreve "05/01" em dezembro quer janeiro do ano que
 * vem, e o palpite acerta metade das vezes). Só que ninguém digita a data de
 * segunda-feira que vem de cabeça, e o fluxo não tinha como calcular: as únicas
 * variáveis nativas eram `nome` e `telefone`.
 *
 * Com estas, o desenho vira um menu de botões, sem modelo nenhum no meio:
 *
 * ```
 * "Para quando?"  [Esta semana] [Semana que vem] [Outro dia]
 *      ↓ Guardar  de={{semana_de}}  ate={{semana_ate}}
 *      ↓ Verandi · horários  ?de={{de}}&ate={{ate}}
 * ```
 *
 * A IA continua ganhando de quem escreve solto ("tem alguma coisa quinta de
 * manhã?"). O que muda é que o cliente sem IA contratada deixa de estar de
 * fora, e o lembrete finalmente consegue escrever "sua aula é amanhã".
 *
 * **`core/` continua sem relógio.** Todas as funções recebem o instante por
 * parâmetro; quem tem relógio é o servidor. É a mesma regra que fez o motor
 * nunca saber que horas são, e ela não abre exceção por conveniência.
 */

/**
 * Os nomes, numa lista só.
 *
 * Serve ao editor (autocompletar), ao validador (não acusar variável
 * desconhecida) e ao resolvedor (saber o que tirar da sessão antes de gravar).
 * Três leitores, uma fonte — a alternativa é o dia em que uma quarta variável
 * nasce e só dois dos três a conhecem.
 */
export const VARIAVEIS_DE_DATA = [
  'hoje',
  'amanha',
  'hoje_br',
  'amanha_br',
  'semana_de',
  'semana_ate',
  'prox_semana_de',
  'prox_semana_ate',
] as const

export type VariavelDeData = (typeof VARIAVEIS_DE_DATA)[number]

/**
 * Calcula as datas para uma conta, num instante.
 *
 * O fuso é o da conta e não o do servidor, pela mesma razão de `hojeNaConta`:
 * em UTC, a partir das 21h em São Paulo, "hoje" já é amanhã — e é justamente o
 * horário em que se manda mensagem para marcar aula.
 */
export function varsDeData(fuso: string, agora: Date = new Date()): Record<string, string> {
  const hoje = emIso(fuso, agora)
  const diaDaSemana = indiceDoDia(fuso, agora)

  /*
   * "Esta semana" começa **hoje**, e não na segunda-feira.
   *
   * Parece errado e é o contrário: ninguém marca aula para anteontem. Uma
   * consulta de disponibilidade que começasse na segunda traria dias que já
   * passaram, e o menu abriria com opções impossíveis — que é pior do que
   * abrir com menos opções.
   */
  const semanaAte = somarDias(hoje, 7 - diaDaSemana)

  /*
   * "Semana que vem" é a semana de calendário seguinte, de segunda a domingo.
   *
   * Aqui a segunda-feira **é** o começo certo, e a diferença com o caso de cima
   * não é inconsistência: "esta semana" é um resto de semana, "semana que vem"
   * é uma semana inteira que ainda não começou.
   */
  const proxDe = somarDias(hoje, 8 - diaDaSemana)
  const proxAte = somarDias(proxDe, 6)
  const amanha = somarDias(hoje, 1)

  return {
    hoje,
    amanha,
    hoje_br: emBr(hoje),
    amanha_br: emBr(amanha),
    semana_de: hoje,
    semana_ate: semanaAte,
    prox_semana_de: proxDe,
    prox_semana_ate: proxAte,
  }
}

/** O dia da semana na conta, com **segunda = 1** e domingo = 7 (ISO 8601). */
function indiceDoDia(fuso: string, agora: Date): number {
  const sigla = new Intl.DateTimeFormat('en-US', { timeZone: fuso, weekday: 'short' }).format(agora)
  const SIGLAS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const posicao = SIGLAS.indexOf(sigla)
  // Fuso inválido não deveria chegar aqui, mas devolver 0 faria a conta de
  // semana render um intervalo de oito dias sem ninguém perceber.
  return posicao === -1 ? 1 : posicao + 1
}

/** `AAAA-MM-DD` no fuso da conta. `en-CA` produz esse formato direto. */
function emIso(fuso: string, agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

/**
 * Soma dias a uma data ISO, sem fuso no meio.
 *
 * Faz a conta em UTC de propósito: a data já está resolvida no fuso da conta,
 * e reintroduzir fuso aqui traria de volta o horário de verão para uma soma que
 * é de calendário, não de relógio. Somar um dia em 31/12 tem que dar 01/01,
 * independentemente de onde a pessoa está.
 */
function somarDias(iso: string, dias: number): string {
  const base = new Date(`${iso}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

/** `2026-08-21` → `21/08/2026`, para a data aparecer numa mensagem. */
function emBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}
