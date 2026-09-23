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

/** "23/09 às 14:32", no fuso de Brasília, que é o de quem lê a tela. */
export function dataDaChamada(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('day')}/${valor('month')} às ${valor('hour')}:${valor('minute')}`
}
