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

/** CPF (11) ou CNPJ (14), só dígitos. Outro tamanho, o Asaas recusa. */
export function documentoParaAsaas(bruto: string | null | undefined): string | null {
  const digitos = (bruto ?? '').replace(/\D/g, '')
  return digitos.length === 11 || digitos.length === 14 ? digitos : null
}
