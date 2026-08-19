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
] as const

export type EventoDeSequencia = (typeof EVENTOS_DE_SEQUENCIA)[number]

export function ehEventoDeSequencia(valor: string): valor is EventoDeSequencia {
  return (EVENTOS_DE_SEQUENCIA as readonly string[]).includes(valor)
}

export const ROTULO_DO_EVENTO: Record<EventoDeSequencia, string> = {
  atendimento_encerrado: 'Quando alguém clicar em “Já atendi”',
  etiqueta_aplicada: 'Quando esta etiqueta for aplicada',
  etapa_alcancada: 'Quando o contato chegar nesta etapa do quadro',
}

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

export type PassoDaSequencia = {
  id: string
  atrasoMinutos: number
  fluxoId: string
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
): { ok: true } | { ok: false; motivo: string } {
  if (!Number.isInteger(minutos) || minutos < 1) {
    return { ok: false, motivo: 'diga em quanto tempo este passo acontece' }
  }
  if (minutos > ATRASO_MAXIMO_MINUTOS) {
    return {
      ok: false,
      motivo:
        'o limite é 24h. Passado disso o WhatsApp só aceita modelo aprovado pela Meta, que ainda não temos — o passo seria desenhado e nunca entregue',
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
