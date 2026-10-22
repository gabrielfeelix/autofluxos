import type { Nicho } from './nichos'

/**
 * O pedido feito pela conversa (0146), sem banco.
 *
 * O status é um código só para todo ramo; o que muda é o nome na tela e quais
 * etapas o ramo usa. Restaurante prepara e entrega, e-commerce separa e
 * envia, comércio de rua entrega na hora. **Aulas não tem pedido**: lá a
 * venda é matrícula e mensalidade, e a tela Pedidos nem aparece.
 */

export const STATUS_DE_PEDIDO = ['novo', 'pago', 'em_preparo', 'saiu', 'entregue', 'cancelado'] as const
export type StatusDePedido = (typeof STATUS_DE_PEDIDO)[number]

export function ehStatusDePedido(valor: unknown): valor is StatusDePedido {
  return typeof valor === 'string' && (STATUS_DE_PEDIDO as readonly string[]).includes(valor)
}

/** Quem usa Pedidos: todo ramo menos aulas. Conta sem ramo também usa. */
export function temPedidos(nicho: Nicho | null | undefined): boolean {
  return nicho !== 'aulas'
}

export type EtapaDoPedido = { status: StatusDePedido; rotulo: string }

const NOMES: Record<StatusDePedido, string> = {
  novo: 'Novo',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  saiu: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const POR_RAMO: Partial<Record<Nicho, Partial<Record<StatusDePedido, string>>>> = {
  ecommerce: { em_preparo: 'Separando', saiu: 'Enviado' },
  comercio: { entregue: 'Retirado' },
}

/** As etapas do quadro, na ordem, sem `cancelado` (que é saída, não etapa). */
export function etapasDoRamo(nicho: Nicho | null | undefined): EtapaDoPedido[] {
  const usadas: StatusDePedido[] =
    nicho === 'comercio' ? ['novo', 'pago', 'entregue'] : ['novo', 'pago', 'em_preparo', 'saiu', 'entregue']
  return usadas.map((status) => ({ status, rotulo: rotuloDoStatus(status, nicho) }))
}

export function rotuloDoStatus(status: StatusDePedido, nicho: Nicho | null | undefined): string {
  return (nicho ? POR_RAMO[nicho]?.[status] : undefined) ?? NOMES[status]
}

/** A etapa seguinte no ramo, ou `null` no fim (e no cancelado). */
export function proximoStatus(atual: StatusDePedido, nicho: Nicho | null | undefined): StatusDePedido | null {
  if (atual === 'cancelado') return null
  const etapas = etapasDoRamo(nicho).map((e) => e.status)
  const i = etapas.indexOf(atual)
  return i >= 0 && i < etapas.length - 1 ? etapas[i + 1]! : null
}

/** Para onde dá para mover à mão: qualquer etapa do ramo, ou cancelar, menos sair do fim. */
export function podeMover(de: StatusDePedido, para: StatusDePedido, nicho: Nicho | null | undefined): boolean {
  if (de === para || de === 'cancelado' || de === 'entregue') return false
  return para === 'cancelado' || etapasDoRamo(nicho).some((e) => e.status === para)
}

/** A coluna de data de cada status, como na tabela. */
export const COLUNA_DO_STATUS: Partial<Record<StatusDePedido, string>> = {
  pago: 'pago_em',
  em_preparo: 'em_preparo_em',
  saiu: 'saiu_em',
  entregue: 'entregue_em',
  cancelado: 'cancelado_em',
}

/**
 * O aviso que vai para o cliente quando o pedido anda, ou `null` quando a
 * etapa não pede aviso (pago já tem o "pagamento confirmado"; entregue na mão
 * dispensa mensagem).
 */
export function avisoDoStatus(
  status: StatusDePedido,
  numero: number,
  nicho: Nicho | null | undefined,
  entrega: 'entrega' | 'retirada' | 'local',
): string | null {
  const pedido = `Seu pedido ${numero}`
  if (status === 'em_preparo') return nicho === 'ecommerce' ? `${pedido} está sendo separado.` : `${pedido} está em preparo.`
  if (status === 'saiu') {
    if (nicho === 'ecommerce') return `${pedido} foi enviado.`
    return entrega === 'entrega' ? `${pedido} saiu para entrega.` : `${pedido} está pronto para retirar.`
  }
  if (status === 'cancelado') return `${pedido} foi cancelado. Se tiver dúvida, é só responder aqui.`
  return null
}
