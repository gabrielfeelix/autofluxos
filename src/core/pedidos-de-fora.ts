import { telefoneCanonico } from './contatos/telefone'
import { STATUS_DE_PEDIDO, type EntregaDoPedido, type StatusDePedido } from './pedidos'

/**
 * O pedido que nasce fora do Dialogon (cardápio digital, delivery próprio,
 * link do entregador), sem banco.
 *
 * Toda plataforma traduz o pedido dela para este formato, e daí em diante ele
 * é um pedido do quadro como outro qualquer (`server/receber-pedido-de-fora.ts`).
 * O status já chega nos nossos seis: o mapa de cada plataforma mora no
 * conector dela (`src/cardapios/<plataforma>.ts`).
 */

export const PLATAFORMAS_DE_PEDIDO = [
  'cardapio_web',
  'olaclick',
  'opendelivery',
  'goomer',
  'delivery_direto',
  'neemo',
  'foody',
  'entregador',
] as const
export type PlataformaDePedido = (typeof PLATAFORMAS_DE_PEDIDO)[number]

export const NOME_DA_PLATAFORMA: Record<PlataformaDePedido, string> = {
  cardapio_web: 'Cardápio Web',
  olaclick: 'OlaClick',
  opendelivery: 'Open Delivery',
  goomer: 'Goomer',
  delivery_direto: 'Delivery Direto',
  neemo: 'Neemo',
  foody: 'Foody Delivery',
  entregador: 'Link do entregador',
}

/** As etapas que avisam o cliente: é nelas que "cliente não avisado" faz sentido. */
export const ETAPAS_QUE_AVISAM: readonly StatusDePedido[] = ['em_preparo', 'saiu', 'cancelado']

export type ItemDePedidoDeFora = { nome: string; quantidade: number; precoCentavos: number }

export type PedidoDeFora = {
  plataforma: PlataformaDePedido
  /** O id do pedido na plataforma: é ele que impede o mesmo pedido de entrar duas vezes. */
  idExterno: string
  /** O número que o cliente vê na plataforma (o "#123" do cardápio). */
  numeroExibido: string
  status: StatusDePedido
  /** Como veio; quem recebe normaliza. `null` quando a plataforma não manda ou mascara. */
  telefone: string | null
  nome: string | null
  entrega: EntregaDoPedido
  endereco: string | null
  totalCentavos: number
  itens: ItemDePedidoDeFora[]
  rastreioUrl: string | null
}

/**
 * O aviso de fora pode mover o pedido? Só para a frente, na ordem de
 * `STATUS_DE_PEDIDO`, e cancelar vale de qualquer etapa antes do fim. Aviso
 * atrasado (`em_preparo` chegando depois de `saiu`) não volta a etapa, e o
 * mesmo aviso duas vezes não move nada.
 */
export function podeAvancar(atual: StatusDePedido, novo: StatusDePedido): boolean {
  if (atual === novo || atual === 'entregue' || atual === 'cancelado') return false
  if (novo === 'cancelado') return true
  return STATUS_DE_PEDIDO.indexOf(novo) > STATUS_DE_PEDIDO.indexOf(atual)
}

/** O evento que a etapa abre, o mesmo `pedido.<status>` dos gatilhos de evento. */
export function eventoDaEtapa(status: StatusDePedido): string {
  return `pedido.${status}`
}

/**
 * O telefone do pedido como `wa_id`, ou `null` quando não dá para avisar:
 * vazio, sem DDD, ou número de central (0800, 0300, 400x). Marketplace
 * repassado pelo cardápio manda a central dele no lugar do cliente, e casar
 * esse número criaria um contato que junta os pedidos de todo mundo.
 */
export function telefoneDoPedido(bruto: string | null): string | null {
  const digitos = (bruto ?? '').replace(/\D/g, '')
  if (/^(0800|0300|0500|0900|400\d)/.test(digitos)) return null
  return digitos ? telefoneCanonico(digitos) : null
}

/**
 * O link de rastreio que o banco aceita (`https://`, até 1000 caracteres), ou
 * `null`. Sem isto, um `http://` da plataforma estouraria o check da 0154 e o
 * pedido inteiro ficaria fora do quadro por causa de um link.
 */
export function rastreioSeguro(url: string | null): string | null {
  const limpo = url?.trim() ?? ''
  return /^https:\/\//.test(limpo) && limpo.length <= 1000 ? limpo : null
}
