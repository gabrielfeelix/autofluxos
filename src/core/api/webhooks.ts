/**
 * Webhooks de saída, sem banco nem rede (fase 3 de
 * `docs/HANDOFF-02-OUT-API-PUBLICA.md`).
 *
 * O AutoFluxos faz um POST no endereço do cliente quando um evento acontece.
 * Cada POST leva:
 *
 * - `x-autofluxos-timestamp`: segundos desde 1970, quando o envio foi assinado;
 * - `x-autofluxos-assinatura`: `sha256=<hex do HMAC-SHA256 de "timestamp.corpo">`
 *   com o segredo do webhook.
 *
 * O timestamp entra na assinatura para o destino poder recusar envio velho
 * (alguém que gravou um POST e repete depois). A documentação recomenda 5 min.
 */

export const EVENTOS_DE_WEBHOOK = [
  {
    chave: 'contato.criado',
    rotulo: 'Contato criado',
    explicacao: 'Alguém novo chegou: pelo WhatsApp, Instagram, chat do site ou pela API.',
  },
  {
    chave: 'contato.etapa_mudou',
    rotulo: 'Etapa do funil mudou',
    explicacao: 'Um negócio foi movido de etapa no funil, pela equipe, por automação ou pela API.',
  },
  {
    chave: 'oportunidade.ganha',
    rotulo: 'Oportunidade ganha',
    explicacao: 'Um negócio foi marcado como ganho, com o valor quando houver.',
  },
  {
    chave: 'oportunidade.perdida',
    rotulo: 'Oportunidade perdida',
    explicacao: 'Um negócio foi marcado como perdido, com o motivo.',
  },
] as const

export type EventoDeWebhook = (typeof EVENTOS_DE_WEBHOOK)[number]['chave']

export function ehEventoDeWebhook(valor: unknown): valor is EventoDeWebhook {
  return typeof valor === 'string' && EVENTOS_DE_WEBHOOK.some((evento) => evento.chave === valor)
}

/** Quanto esperar antes de cada nova tentativa: 1 min, 5 min, 30 min, 2 h, 12 h. */
export const ESPERAS_EM_SEGUNDOS = [60, 5 * 60, 30 * 60, 2 * 3600, 12 * 3600] as const

/** Primeira tentativa mais as cinco novas. */
export const MAXIMO_DE_TENTATIVAS = ESPERAS_EM_SEGUNDOS.length + 1

/** Falhas seguidas (somando entregas) até o webhook pausar sozinho. */
export const FALHAS_ATE_PAUSAR = 20

/** Quantos webhooks uma organização pode ter. */
export const WEBHOOKS_POR_ORGANIZACAO = 5

export const TEMPO_LIMITE_EM_MS = 10_000

export const PREFIXO_DO_SEGREDO = 'whsec_'

/**
 * Depois de `tentativas` envios que falharam, em quantos segundos tentar de
 * novo. `null` = desistir.
 */
export function esperaDepoisDe(tentativas: number): number | null {
  if (tentativas < 1) return 0
  return ESPERAS_EM_SEGUNDOS[tentativas - 1] ?? null
}

/** 2xx é entregue. Qualquer outra coisa (3xx incluso: não seguimos redirecionamento) é falha. */
export function foiEntregue(statusHttp: number): boolean {
  return statusHttp >= 200 && statusHttp < 300
}

/** O texto que é assinado: `"<timestamp>.<corpo>"`. */
export function textoAssinado(timestamp: number, corpo: string): string {
  return `${timestamp}.${corpo}`
}
