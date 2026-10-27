import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import type { ResultadoDaLoja } from '@/loja/types'

/**
 * O contrato de toda plataforma de cardápio digital ou delivery
 * (docs/PLANO-INTEGRACOES-CARDAPIO.md). Cada uma mora em
 * `src/cardapios/<plataforma>.ts` e só traduz: o catálogo dela para
 * `ItemDeCatalogo`, o pedido dela para `PedidoDeFora`, com o status já nos
 * nossos seis. O que fazer com isso é de `server/receber-pedido-de-fora.ts`.
 */

export type ItemDeCatalogo = {
  idExterno: string
  nome: string
  descricao: string | null
  precoCentavos: number | null
  /** `https://` ou nulo. */
  foto: string | null
  categoria: string | null
  disponivel: boolean
}

export type ConectorDeCardapio = {
  lerCatalogo(): Promise<ResultadoDaLoja<ItemDeCatalogo[]>>
  /** Os pedidos que mudaram desde `desde`: é a passada de 10 minutos, a rede de segurança do webhook. */
  pedidosDesde(desde: Date): Promise<ResultadoDaLoja<PedidoDeFora[]>>
  lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>>
}
