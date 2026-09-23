import { diaEHora } from './datas'

/**
 * O que a tela diz da última chamada de um webhook de entrada (tarefa 5.7).
 *
 * Três respostas, porque são três situações que quem monta a integração do
 * outro lado precisa separar: nada chegou (o outro sistema nem chamou), chegou
 * e foi aceita, chegou e a assinatura não conferiu. A mais recente das duas
 * datas ganha: consertar a assinatura depois de uma recusa troca o aviso.
 */
export type EstadoDoWebhook =
  | { tipo: 'nunca' }
  | { tipo: 'autenticada'; em: string }
  | { tipo: 'recusada'; em: string }

export function estadoDoWebhook(webhook: { ultimaEm: string | null; recusadaEm: string | null }): EstadoDoWebhook {
  const { ultimaEm, recusadaEm } = webhook
  if (!ultimaEm && !recusadaEm) return { tipo: 'nunca' }
  if (recusadaEm && (!ultimaEm || Date.parse(recusadaEm) > Date.parse(ultimaEm))) {
    return { tipo: 'recusada', em: recusadaEm }
  }
  return { tipo: 'autenticada', em: ultimaEm as string }
}

/** A hora da chamada, no mesmo formato das outras datas curtas da tela. */
export const dataDaChamada = (iso: string) => diaEHora(iso)
