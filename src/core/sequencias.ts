import { JANELA_MS } from '@/channels/janela'

/**
 * As sequências: acompanhar sozinho quem parou (0031).
 *
 * Puro e sem rede, como todo `core/`. O que mora aqui é a régua — quais eventos
 * inscrevem, quanto tempo cabe, o que é o próximo passo — e é justamente o que
 * precisa dar para testar sem banco e sem WhatsApp.
 */

/**
 * O que inscreve alguém.
 *
 * Os três são **atos deliberados sobre um contato**: alguém encerrou um
 * atendimento, alguém aplicou uma etiqueta, ou o fluxo pôs a pessoa numa etapa
 * do quadro. Isso não é acaso — é a diferença entre acompanhamento e disparo em
 * massa. Um evento genérico ("chegou contato novo") poria a sequência
 * disputando a conversa com o fluxo de entrada, e as duas falariam por cima uma
 * da outra.
 *
 * `etapa_alcancada` (0034) é o que junta quadro e sequência, e é o pedido do
 * cliente real: *"entrou em Aula agendada e não compareceu"*. Dava para exigir
 * que o fluxo aplicasse uma etiqueta junto e reusar o evento de etiqueta — mas
 * isso obrigaria a conta a manter duas coisas em sincronia à mão, e no dia em
 * que alguém movesse o cartão pela tela o acompanhamento não aconteceria, sem
 * erro nenhum para investigar.
 */
export const EVENTOS_DE_SEQUENCIA = [
  'atendimento_encerrado',
  'etiqueta_aplicada',
  'etapa_alcancada',
  /**
   * O único que **ninguém dispara** (0070).
   *
   * Os três de cima são atos deliberados: alguém encerrou, alguém etiquetou,
   * alguém moveu o cartão. Este é o tempo passando, e é justamente por isso que
   * ele existe — o cliente que some não gera evento nenhum, e é assim que o
   * pós-venda se perde: ninguém percebe até a hora da renovação.
   */
  'cliente_sumido',
] as const

export type EventoDeSequencia = (typeof EVENTOS_DE_SEQUENCIA)[number]

export function ehEventoDeSequencia(valor: string): valor is EventoDeSequencia {
  return (EVENTOS_DE_SEQUENCIA as readonly string[]).includes(valor)
}

export const ROTULO_DO_EVENTO: Record<EventoDeSequencia, string> = {
  atendimento_encerrado: 'Quando alguém clicar em “Já atendi”',
  etiqueta_aplicada: 'Quando esta etiqueta for aplicada',
  etapa_alcancada: 'Quando o contato chegar nesta etapa do quadro',
  cliente_sumido: 'Quando um cliente parar de falar com você',
}

/**
 * Quantos dias calado para a régua de retomada entrar.
 *
 * Mínimo de uma semana porque abaixo disso não é sumiço, é fim de semana. Teto
 * de um ano porque quem não fala há mais que isso não volta com uma mensagem —
 * volta com uma oferta nova, que é outro trabalho.
 */
export const DIAS_SEM_CONVERSA = { minimo: 7, maximo: 365, padrao: 60 } as const

/**
 * O teto de cada passo, em minutos: **24 horas**.
 *
 * Não é escolha de produto, é a janela da Meta — e a conta que a torna
 * inescapável está no comentário da 0031: quem responde sai da sequência, então
 * a última mensagem da pessoa é sempre anterior ao evento que a inscreveu. O
 * relógio da janela já está correndo quando a sequência começa.
 *
 * Um passo além disso não seria "atrasado": seria **nunca entregue**, com a
 * Cloud API devolvendo `(#131047) Re-engagement message`. Deixar desenhar é
 * deixar alguém montar um acompanhamento de sete dias que não manda nada.
 */
export const ATRASO_MAXIMO_MINUTOS = JANELA_MS / 60_000

/**
 * Quantos passos cabem numa sequência.
 *
 * Cinco, e o limite é de produto: cinco mensagens dentro de 24 horas para quem
 * não respondeu nenhuma já é o teto do que alguém tolera. O sexto passo não
 * traz lead nenhum — traz bloqueio, que é o custo que não se desfaz.
 */
export const LIMITE_DE_PASSOS = 5

/**
 * O teto de um passo: 30 dias.
 *
 * Era 1440 (24h) porque fora da janela o WhatsApp recusa texto livre, e a 0031
 * escreveu que o teto subiria quando os modelos aprovados existissem. Eles
 * existem (0059), e o teto subiu na 0061.
 *
 * 30 dias e não "sem teto": sequência de seis meses é quase sempre engano de
 * digitação, e um agendamento que fica seis meses na fila é seis meses de
 * chance de o número, o fluxo ou o cliente não existirem mais.
 */
export const TETO_DO_PASSO_MINUTOS = 43_200

/** Acima disto, o passo **precisa** de modelo aprovado. É a janela da Meta. */
export const JANELA_EM_MINUTOS = 1_440

export type PassoDaSequencia = {
  id: string
  atrasoMinutos: number
  fluxoId: string
  /**
   * O modelo aprovado que este passo manda, quando ele cai fora da janela.
   *
   * Nulo é o caso comum: passo dentro das 24h não precisa de modelo, e exigir
   * um seria cobrar aprovação da Meta para mandar a segunda mensagem de uma
   * conversa que está acontecendo agora.
   *
   * Acima de `JANELA_EM_MINUTOS` ele deixa de ser opcional — ver
   * `passoEntregavel`. Sem modelo, um passo de 3 dias não é "um passo longo":
   * é um passo que o executor vai encontrar com a janela fechada e encerrar
   * sem entregar nada.
   */
  templateId?: string | null
}

export type Sequencia = {
  id: string
  nome: string
  evento: EventoDeSequencia
  etiquetaId: string | null
  etiquetaDeSaidaId: string | null
  /** A etapa que dispara, quando o evento é `etapa_alcancada` (0034). */
  colunaId: string | null
  ativa: boolean
  passos: PassoDaSequencia[]
}

/**
 * Por que alguém saiu.
 *
 * Escrito como lista fechada porque vira texto na tela e número no relatório:
 * "saíram porque responderam" é a sequência funcionando, e "saíram porque o bot
 * foi pausado" é outra conversa inteiramente.
 */
export const MOTIVOS_DE_SAIDA = {
  respondeu: 'a pessoa respondeu',
  atendimento: 'alguém assumiu a conversa',
  automacao_pausada: 'o bot foi pausado neste contato',
  etiqueta_de_saida: 'ganhou a etiqueta de saída',
  janela_fechada: 'a janela de 24h fechou antes do próximo passo',
  sem_fluxo: 'o fluxo do passo não está publicado',
} as const

export type MotivoDeSaida = keyof typeof MOTIVOS_DE_SAIDA

/**
 * Os passos na ordem em que acontecem.
 *
 * A ordem sai do atraso, e não da ordem de criação: quem acrescenta um passo de
 * 30 minutos depois de já ter um de 6 horas está inserindo no meio, e ordenar
 * pela criação faria a sequência mandar a mensagem de 6h antes da de 30min.
 */
export function passosEmOrdem(passos: PassoDaSequencia[]): PassoDaSequencia[] {
  return [...passos].sort((a, b) => a.atrasoMinutos - b.atrasoMinutos)
}

/** O passo de índice `indice`, ou `null` quando a sequência acabou. */
export function passoDoIndice(
  passos: PassoDaSequencia[],
  indice: number,
): PassoDaSequencia | null {
  return passosEmOrdem(passos)[indice] ?? null
}

/**
 * Quando este passo deve rodar, contando do evento.
 *
 * Recebe o instante do evento e não `Date.now()` porque um passo reagendado
 * depois de uma falha precisa cair no mesmo horário de sempre — recontar do
 * agora empurraria a sequência inteira para a frente a cada tentativa, e o
 * passo de 20h chegaria fora da janela por causa de um erro de rede.
 */
export function quandoRodaOPasso(entrouEm: Date, passo: PassoDaSequencia): Date {
  return new Date(entrouEm.getTime() + passo.atrasoMinutos * 60_000)
}

/**
 * O passo cabe na janela que restava quando a pessoa entrou?
 *
 * É a conferência de desenho — a tela usa para avisar antes de alguém publicar
 * um passo que nunca entregaria. O executor confere **de novo** na hora de
 * mandar, com a janela real do contato: o desenho responde "faz sentido?", e a
 * entrega responde "dá agora?".
 */
export function cabeNaJanela(
  passo: PassoDaSequencia,
  restanteMsNoEvento: number = JANELA_MS,
): boolean {
  return passo.atrasoMinutos * 60_000 <= restanteMsNoEvento
}

/** "30min", "2h", "20h30" — o mesmo formato do relógio da fila. */
export function comoAtraso(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const sobra = minutos % 60
  return sobra === 0 ? `${horas}h` : `${horas}h${String(sobra).padStart(2, '0')}`
}

/**
 * A régua de um passo novo, antes de o banco ver qualquer coisa.
 *
 * O `check` da migration diz a mesma coisa; isto existe para a recusa chegar
 * como frase e não como violação de restrição — que é o que a pessoa lê.
 */
export function conferirAtraso(
  minutos: number,
  jaExistentes: number[],
  /**
   * O modelo aprovado deste passo, quando há um (0061).
   *
   * Sem ele, o teto continua sendo 24h — e não por escolha nossa: fora da
   * janela o WhatsApp recusa texto livre, e o passo seria desenhado e nunca
   * entregue. Com ele, o teto é 30 dias.
   */
  templateId?: string | null,
): { ok: true } | { ok: false; motivo: string } {
  if (!Number.isInteger(minutos) || minutos < 1) {
    return { ok: false, motivo: 'diga em quanto tempo este passo acontece' }
  }
  if (minutos > TETO_DO_PASSO_MINUTOS) {
    return {
      ok: false,
      motivo: 'o limite é 30 dias',
    }
  }
  if (minutos > ATRASO_MAXIMO_MINUTOS && !templateId) {
    return {
      ok: false,
      motivo:
        'passado de 24h o WhatsApp só entrega modelo aprovado pela Meta. Escolha um modelo para este passo, ou encurte o tempo',
    }
  }
  if (jaExistentes.includes(minutos)) {
    return { ok: false, motivo: 'já existe um passo neste mesmo tempo' }
  }
  if (jaExistentes.length >= LIMITE_DE_PASSOS) {
    return { ok: false, motivo: `uma sequência tem no máximo ${LIMITE_DE_PASSOS} passos` }
  }
  return { ok: true }
}

/**
 * Este passo tem como entregar alguma coisa?
 *
 * Substitui `cabeNaJanela` como pergunta de desenho, e a diferença é o modelo:
 * antes, passo fora das 24h era simplesmente impossível; agora ele é possível
 * **se** carregar um modelo aprovado.
 *
 * `cabeNaJanela` continua existindo e continua certa para o que ela responde —
 * "isto cabe em texto livre?". Esta responde a pergunta que a tela precisa
 * fazer: "isto vai chegar em alguém?".
 */
export function passoEntregavel(passo: PassoDaSequencia): boolean {
  if (passo.atrasoMinutos <= JANELA_EM_MINUTOS) return true
  return Boolean(passo.templateId)
}

/**
 * O que dizer a quem desenhou um passo que não entregaria.
 *
 * `null` quando está tudo certo. O recado é em português e diz o caminho de
 * saída, porque a alternativa — desabilitar o campo acima de 24h — esconderia
 * que o recurso existe.
 */
export function porQueNaoEntrega(passo: PassoDaSequencia): string | null {
  if (passoEntregavel(passo)) return null
  return (
    'Passos com mais de 24 horas só chegam por um modelo aprovado pela Meta — ' +
    'fora desse prazo o WhatsApp não entrega texto livre. Escolha um modelo para este passo.'
  )
}
