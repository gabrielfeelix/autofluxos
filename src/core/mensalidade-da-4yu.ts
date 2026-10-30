import { custoDaEquipe, type CicloDeCobranca, type Plano } from './planos'

/**
 * Quanto a assinatura do Asaas cobra, em centavos (docs/PLANO-MENSALIDADE-ASAAS.md).
 *
 * O plano mais os atendentes extras, que entram no valor da assinatura e não
 * numa cobrança à parte. No anual, o extra é cobrado pelos 12 meses, junto.
 * `null` quando o plano não tem anual: a tela nem deveria oferecer.
 */
export function valorDaAssinatura(
  plano: Pick<Plano, 'preco' | 'precoAnual' | 'atendentes' | 'precoAtendenteExtra'>,
  ciclo: CicloDeCobranca,
  pessoas: number,
): number | null {
  const equipe = custoDaEquipe(plano, pessoas).valor
  const reais = ciclo === 'anual' ? (plano.precoAnual === null ? null : plano.precoAnual + equipe * 12) : plano.preco + equipe
  return reais === null ? null : Math.round(reais * 100)
}

/** `19700` vira `R$ 197,00`. */
export function reaisDeCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** CPF (11) ou CNPJ (14), só dígitos. Outro tamanho, o Asaas recusa. */
export function documentoParaAsaas(bruto: string | null | undefined): string | null {
  const digitos = (bruto ?? '').replace(/\D/g, '')
  return digitos.length === 11 || digitos.length === 14 ? digitos : null
}

/**
 * O texto da assinatura no Asaas, com a composição do valor. É o que aparece
 * na fatura do Asaas, no e-mail dele e no detalhe da fatura aqui: a pessoa vê
 * de onde vem cada real sem precisar perguntar.
 */
export function descricaoDaAssinatura(
  plano: Pick<Plano, 'nome' | 'preco' | 'precoAnual' | 'atendentes' | 'precoAtendenteExtra'>,
  ciclo: CicloDeCobranca,
  pessoas: number,
): string {
  const equipe = custoDaEquipe(plano, pessoas)
  const meses = ciclo === 'anual' ? 12 : 1
  const base = ciclo === 'anual' && plano.precoAnual !== null ? plano.precoAnual : plano.preco
  const partes = [`plano ${reaisDeCentavos(Math.round(base * 100))}`]
  if (equipe.extras > 0) {
    partes.push(
      `${equipe.extras} ${equipe.extras === 1 ? 'atendente extra' : 'atendentes extras'} ${reaisDeCentavos(Math.round(equipe.valor * meses * 100))}`,
    )
  }
  return `Dialogon ${plano.nome}, ${ciclo}: ${partes.join(' + ')}`
}

export type FiltroDeFaturas = {
  situacao: 'todas' | 'em_aberto' | 'pagas' | 'vencidas' | 'canceladas'
  tipo: 'todos' | 'mensalidade' | 'excedente'
  /** `aaaa`, ou `todos`. */
  ano: string
}

export const FILTRO_INICIAL: FiltroDeFaturas = { situacao: 'todas', tipo: 'todos', ano: 'todos' }

type FaturaFiltravel = { tipo: string; estado: string; vencimento: string; valorCentavos: number; pagaEm: string | null }

export function filtrarFaturas<F extends FaturaFiltravel>(faturas: F[], filtro: FiltroDeFaturas): F[] {
  return faturas.filter((f) => {
    if (filtro.tipo !== 'todos' && f.tipo !== filtro.tipo) return false
    if (filtro.ano !== 'todos' && !f.vencimento.startsWith(filtro.ano)) return false
    switch (filtro.situacao) {
      case 'em_aberto':
        return f.estado === 'pendente' || f.estado === 'vencida'
      case 'pagas':
        return f.estado === 'paga'
      case 'vencidas':
        return f.estado === 'vencida'
      case 'canceladas':
        return f.estado === 'cancelada' || f.estado === 'estornada'
      default:
        return true
    }
  })
}

/** Os números do topo da tela: quanto está em aberto e quanto foi pago no ano. */
export function resumoDasFaturas(faturas: FaturaFiltravel[], ano: string): { emAberto: number; pagoNoAno: number; abertas: number } {
  let emAberto = 0
  let pagoNoAno = 0
  let abertas = 0
  for (const f of faturas) {
    if (f.estado === 'pendente' || f.estado === 'vencida') {
      emAberto += f.valorCentavos
      abertas += 1
    }
    if (f.estado === 'paga' && (f.pagaEm ?? f.vencimento).startsWith(ano)) pagoNoAno += f.valorCentavos
  }
  return { emAberto, pagoNoAno, abertas }
}

export function ehFiltroDeFaturas(valor: Record<string, string | undefined>): FiltroDeFaturas {
  const situacoes: FiltroDeFaturas['situacao'][] = ['todas', 'em_aberto', 'pagas', 'vencidas', 'canceladas']
  const tipos: FiltroDeFaturas['tipo'][] = ['todos', 'mensalidade', 'excedente']
  return {
    situacao: situacoes.find((s) => s === valor.situacao) ?? 'todas',
    tipo: tipos.find((t) => t === valor.tipo) ?? 'todos',
    ano: /^\d{4}$/.test(valor.ano ?? '') ? valor.ano! : 'todos',
  }
}
