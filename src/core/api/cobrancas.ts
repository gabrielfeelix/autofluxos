/**
 * A cobrança como a API pública e os webhooks de saída mostram (frente 4 do
 * handoff de 22/out). Um formato só nos dois lugares: quem integra lê a lista
 * pela API e recebe o `cobranca.paga` com os mesmos campos.
 *
 * Valor em reais, com duas casas, como o resto da API (`oportunidade.valor`).
 * Por dentro o produto conta em centavos; a conversão mora só aqui.
 */

export type CobrancaDaApi = {
  id: string
  contato_id: string | null
  descricao: string
  valor: number
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada' | 'estornada'
  gateway: 'mercado_pago' | 'asaas'
  pix_copia_cola: string | null
  link: string | null
  vence_em: string
  paga_em: string | null
  cancelada_em: string | null
  origem: 'inbox' | 'fluxo' | 'ia' | 'api'
  criado_em: string
}

/** O que a conversão precisa da cobrança registrada, sem depender do repositório. */
export type CobrancaParaApi = {
  id: string
  contatoId: string | null
  descricao: string
  valorCentavos: number
  status: CobrancaDaApi['status']
  gateway: CobrancaDaApi['gateway']
  pixCopiaCola: string | null
  link: string | null
  venceEm: string
  pagaEm: string | null
  canceladaEm: string | null
  origem: CobrancaDaApi['origem']
  criadoEm: string
}

export function paraCobrancaDaApi(c: CobrancaParaApi): CobrancaDaApi {
  return {
    id: c.id,
    contato_id: c.contatoId,
    descricao: c.descricao,
    valor: centavosParaReais(c.valorCentavos),
    status: c.status,
    gateway: c.gateway,
    pix_copia_cola: c.pixCopiaCola,
    link: c.link,
    vence_em: c.venceEm,
    paga_em: c.pagaEm,
    cancelada_em: c.canceladaEm,
    origem: c.origem,
    criado_em: c.criadoEm,
  }
}

export function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100
}

/**
 * Reais recebidos pela API para centavos, ou `null` se o número não é um valor
 * de dinheiro: mais de duas casas, zero, negativo. `Math.round` desfaz o erro
 * de ponto flutuante (19.99 × 100 = 1998.9999999999998), e a conferência das
 * casas recusa 10.005 em vez de arredondar o que o outro sistema mandou.
 */
export function reaisParaCentavos(reais: number): number | null {
  if (!Number.isFinite(reais) || reais <= 0) return null
  const centavos = Math.round(reais * 100)
  if (Math.abs(centavos - reais * 100) > 1e-6) return null
  return centavos
}
