/**
 * As contas de data da mensalidade (0145), sem banco e sem relógio.
 *
 * Tudo em dia civil de São Paulo, como texto `AAAA-MM-DD`: o vencimento é
 * "dia 10", não um instante, e fuso de servidor não pode empurrar a cobrança
 * para o dia seguinte. O Brasil não tem horário de verão desde 2019, então o
 * fim do dia é sempre `-03:00`.
 *
 * A competência é o mês cobrado, guardado como dia 1 (`2026-11-01`).
 */

export const MODOS_DE_MENSALIDADE = ['pix_do_mes', 'cartao', 'pix_automatico'] as const
export type ModoDeMensalidade = (typeof MODOS_DE_MENSALIDADE)[number]

export const STATUS_DE_MENSALIDADE = ['ativa', 'aguardando', 'pausada', 'cancelada'] as const
export type StatusDeMensalidade = (typeof STATUS_DE_MENSALIDADE)[number]

export const DIA_MAXIMO = 28
export const ANTECEDENCIA_PADRAO = 3
export const ANTECEDENCIA_MAXIMA = 15

export type RegraDoMes = {
  inicio: string
  fim: string | null
  diaDoVencimento: number
  antecedenciaDias: number
}

const DIA_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de hoje em São Paulo, `AAAA-MM-DD`. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return DIA_SP.format(agora)
}

/** O mês da data, como dia 1. */
export function competenciaDe(dia: string): string {
  return `${dia.slice(0, 7)}-01`
}

/** O mês seguinte, como dia 1. */
export function mesSeguinte(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number]
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
}

export function vencimentoDa(competencia: string, diaDoVencimento: number): string {
  return `${competencia.slice(0, 8)}${String(diaDoVencimento).padStart(2, '0')}`
}

function menosDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** O fim do dia do vencimento em São Paulo, como instante. */
export function fimDoDia(dia: string): Date {
  return new Date(`${dia}T23:59:59-03:00`)
}

/**
 * Que mês desta mensalidade deve ser cobrado hoje, ou `null`.
 *
 * Cobra quando hoje está entre o dia de mandar (vencimento menos a
 * antecedência) e o vencimento. Passou do vencimento sem gerar (o relógio não
 * rodou), o mês é pulado de propósito: cobrança que nasce vencida é Pix que
 * ninguém paga, e a equipe vê o buraco na ficha.
 *
 * Olha o mês corrente e o seguinte: com vencimento no dia 2 e antecedência de
 * 5, a cobrança de novembro sai em 28 de outubro.
 */
export function competenciaParaCobrar(regra: RegraDoMes, hoje: string): string | null {
  const atual = competenciaDe(hoje)
  for (const competencia of [atual, mesSeguinte(atual)]) {
    if (competencia < regra.inicio) continue
    if (regra.fim && competencia > regra.fim) continue
    const vencimento = vencimentoDa(competencia, regra.diaDoVencimento)
    const envio = menosDias(vencimento, regra.antecedenciaDias)
    if (envio <= hoje && hoje <= vencimento) return competencia
  }
  return null
}

/** O dia em que a cobrança deste mês sai: vencimento menos a antecedência. */
export function diaDeMandar(regra: Pick<RegraDoMes, 'diaDoVencimento' | 'antecedenciaDias'>, competencia: string): string {
  return menosDias(vencimentoDa(competencia, regra.diaDoVencimento), regra.antecedenciaDias)
}

/**
 * O primeiro mês de uma mensalidade criada hoje: o corrente se o vencimento
 * dele ainda não passou, senão o próximo.
 */
export function primeiraCompetencia(hoje: string, diaDoVencimento: number): string {
  const atual = competenciaDe(hoje)
  return hoje <= vencimentoDa(atual, diaDoVencimento) ? atual : mesSeguinte(atual)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "novembro de 2026". */
export function nomeDaCompetencia(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number]
  return `${MESES[m - 1]} de ${a}`
}

/** A descrição da cobrança do mês: "Mensalidade Pilates 2x (novembro de 2026)". */
export function descricaoDoMes(descricao: string, competencia: string): string {
  const sufixo = ` (${nomeDaCompetencia(competencia)})`
  return descricao.trim().slice(0, 200 - sufixo.length) + sufixo
}

// ---------------------------------------------------------------------------
// O modelo do lembrete fora das 24 horas
// ---------------------------------------------------------------------------

/**
 * O modelo de utilidade que leva a cobrança a quem não conversa há mais de
 * 24 horas. É o mesmo para toda conta, criado por ela num toque em Ajustes >
 * Pagamentos, e achado pelo nome. O botão Pagar abre a nossa página da
 * cobrança (`/pagar/<código>`), que mostra o Pix e o link do gateway.
 */
export const NOME_DO_MODELO_DE_COBRANCA = 'lembrete_de_cobranca'

export const CORPO_DO_MODELO_DE_COBRANCA =
  'Olá, {{1}}! Sua cobrança de {{2}}, no valor de {{3}}, vence em {{4}}. Toque em Pagar para ver o Pix ou pagar com cartão.'

export const EXEMPLOS_DO_MODELO_DE_COBRANCA = ['Ana', 'Mensalidade (novembro de 2026)', 'R$ 280,00', '10/11']
