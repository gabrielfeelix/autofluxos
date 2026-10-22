import type { StatusDeMensalidade } from './mensalidade'

/**
 * Os números das mensalidades (0145) de um período, sem banco: Análise >
 * Vendas, para quem cobra mensalidade pelo AutoFluxos (no ramo de aulas,
 * é a matrícula).
 *
 * **Em dia** é a mensalidade ativa sem nenhuma cobrança vencida e não paga
 * nos últimos 60 dias; mais antiga que isso já é caso da equipe, não do
 * relatório. Faltas e aula experimental moram na Verandi, e ler de lá cruzaria
 * os dois produtos no banco: ficam de fora até haver ponte própria.
 */

export type AssinaturaParaAnalise = {
  id: string
  status: StatusDeMensalidade
  criadoEm: string
  canceladaEm: string | null
}

export type CobrancaDeMensalidade = {
  assinaturaId: string
  competencia: string | null
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada' | 'estornada'
  valorCentavos: number
  venceEm: string
  pagaEm: string | null
}

export type AnaliseDeMensalidades = {
  novas: number
  aguardandoAdesao: number
  ativas: number
  pausadas: number
  emDia: number
  emAtraso: number
  /** Das ativas, quantas estão em dia. */
  taxaEmDia: number | null
  canceladas: number
  recebidoCentavos: number
}

const DIA = 86_400_000

/** `ini` incluído, `fim` excluído, como instantes. */
export function analisarMensalidades(
  assinaturas: readonly AssinaturaParaAnalise[],
  cobrancas: readonly CobrancaDeMensalidade[],
  ini: Date,
  fim: Date,
  agora: Date = new Date(),
): AnaliseDeMensalidades {
  const noPeriodo = (iso: string | null) => iso !== null && new Date(iso) >= ini && new Date(iso) < fim
  const pagas = new Set(cobrancas.filter((c) => c.status === 'paga').map((c) => `${c.assinaturaId}|${c.competencia}`))
  const atrasadas = new Set(
    cobrancas
      .filter(
        (c) =>
          c.status === 'vencida' &&
          agora.getTime() - new Date(c.venceEm).getTime() <= 60 * DIA &&
          !pagas.has(`${c.assinaturaId}|${c.competencia}`),
      )
      .map((c) => c.assinaturaId),
  )
  const ativas = assinaturas.filter((a) => a.status === 'ativa')
  const emAtraso = ativas.filter((a) => atrasadas.has(a.id)).length
  return {
    novas: assinaturas.filter((a) => noPeriodo(a.criadoEm)).length,
    aguardandoAdesao: assinaturas.filter((a) => a.status === 'aguardando').length,
    ativas: ativas.length,
    pausadas: assinaturas.filter((a) => a.status === 'pausada').length,
    emDia: ativas.length - emAtraso,
    emAtraso,
    taxaEmDia: ativas.length === 0 ? null : (ativas.length - emAtraso) / ativas.length,
    canceladas: assinaturas.filter((a) => noPeriodo(a.canceladaEm)).length,
    recebidoCentavos: cobrancas.filter((c) => c.status === 'paga' && noPeriodo(c.pagaEm)).reduce((s, c) => s + c.valorCentavos, 0),
  }
}
