/**
 * O contrato de plano de uma organização no tempo: quando a descida vale, o
 * excedente do mês, os avisos de consumo e os de véspera.
 *
 * Puro, sem banco, pelas mesmas razões de `core/planos.ts`: é data e
 * aritmética, e conta de dinheiro sem teste é onde a fatura erra.
 *
 * As decisões estão em `docs/PLANO-ADMINISTRACAO-2026-09-24.md`, seções 8 e
 * 8.1: descida na virada do mês, subida na hora; excedente por conversa na
 * fatura seguinte; aviso em 80% e 100% da faixa; aviso 7 e 1 dia antes da
 * descida; preço novo para quem já está no plano só com 30 dias de aviso.
 */

/** O mesmo fuso de `repos/plano.ts`: a régua do mês é uma só. */
const FUSO = 'America/Sao_Paulo'

const partesDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de hoje em São Paulo, `YYYY-MM-DD`. */
export function diaDeHoje(agora: Date): string {
  return partesDoDia.format(agora)
}

/** O primeiro dia do mês seguinte, `YYYY-MM-01`: quando a descida vale. */
export function proximaVirada(agora: Date): string {
  const [ano, mes] = diaDeHoje(agora).split('-').map(Number) as [number, number]
  const seguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }
  return `${seguinte.ano}-${String(seguinte.mes).padStart(2, '0')}-01`
}

/** Um dia `YYYY-MM-DD` somado de `dias`. */
export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T12:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

/** Quantos dias faltam de hoje (São Paulo) até `dia`. Zero é hoje; negativo, já passou. */
export function diasAte(dia: string, agora: Date): number {
  const hoje = Date.parse(`${diaDeHoje(agora)}T12:00:00Z`)
  const alvo = Date.parse(`${dia}T12:00:00Z`)
  return Math.round((alvo - hoje) / 86_400_000)
}

/** `2026-10-01` como "1º de outubro". */
export function diaPorExtenso(dia: string): string {
  const data = new Date(`${dia}T12:00:00Z`)
  const mes = data.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const numero = data.getUTCDate()
  return `${numero === 1 ? '1º' : numero} de ${mes}`
}

/** Reais com centavos só quando há centavos: "R$ 0,40", "R$ 1.097". */
export function reais(valor: number): string {
  const inteiro = Number.isInteger(Math.round(valor * 100) / 100)
  return `R$ ${valor.toLocaleString('pt-BR', inteiro ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type Excedente = {
  /** Conversas acima da faixa no mês. Zero quando coube. */
  conversas: number
  precoPorConversa: number
  /** Em reais, arredondado ao centavo. */
  valor: number
}

/** O excedente do mês: o que passou da faixa, vezes o preço por conversa. */
export function excedente(conversas: number, plano: { conversas: number; precoExcedente: number }): Excedente {
  const passou = Math.max(0, conversas - plano.conversas)
  return {
    conversas: passou,
    precoPorConversa: plano.precoExcedente,
    valor: Math.round(passou * plano.precoExcedente * 100) / 100,
  }
}

/** A frase do excedente, a mesma no modal e na tela Plano e consumo. */
export function fraseDoExcedente(e: Excedente): string | null {
  if (e.conversas <= 0) return null
  const n = e.conversas.toLocaleString('pt-BR')
  return `Passou ${n} ${e.conversas === 1 ? 'conversa' : 'conversas'}; a ${reais(e.precoPorConversa)} cada, são ${reais(e.valor)} a mais neste mês.`
}

/**
 * A faixa de aviso de consumo: 80% avisa que está chegando, 100% que passou.
 * Nulo abaixo de 80%, e com plano sem faixa (zero conversas).
 */
export function faixaDoConsumo(conversas: number, limite: number): 80 | 100 | null {
  if (limite <= 0) return null
  const fracao = conversas / limite
  if (fracao >= 1) return 100
  if (fracao >= 0.8) return 80
  return null
}

/** Os dias antes da descida em que o aviso sai, no app e por e-mail. */
export const AVISOS_DA_DESCIDA = [7, 1] as const

/**
 * Qual aviso de véspera cabe hoje, ou nulo. O de 7 sai no primeiro dia dentro
 * da janela (quem agendou a 3 dias da virada recebe na hora, não nunca), e o
 * de 1 na véspera. A chave em `avisos_de_plano` impede repetir.
 */
export function avisoDaDescida(para: string, agora: Date): 7 | 1 | null {
  const faltam = diasAte(para, agora)
  if (faltam < 1) return null
  if (faltam <= 1) return 1
  if (faltam <= 7) return 7
  return null
}

/** O aviso do preço novo: 30 dias antes de valer. */
export const DIAS_DE_AVISO_DO_PRECO = 30

/** O preço que vale hoje: o contratado, senão o do plano. */
export function precoEmVigor(contrato: { precoContratado: number | null }, plano: { preco: number }): number {
  return contrato.precoContratado ?? plano.preco
}
