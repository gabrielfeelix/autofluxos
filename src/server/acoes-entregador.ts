'use server'

import type { StatusDePedido } from '@/core/pedidos'
import { criarTokenDoEntregador } from './entregador/token'
import { ENDERECO_DO_ENTREGADOR, passoDoEntregador, type PassoDoEntregador } from './entregador/link'
import { exigirCapacidade, recusou } from './permissoes'
import { acharPedido } from './repos/pedidos'

/**
 * O link do entregador (docs/PLANO-INTEGRACOES-CARDAPIO.md, Fase 1).
 *
 * `acaoEntregador` é a **única ação sem sessão** deste arquivo: quem chama é
 * o motoboy, pela página `/e/<token>`, e a autorização é o token assinado.
 * Ela só sabe mover aquele pedido para `saiu` ou `entregue`.
 */

export async function acaoEntregador(
  token: string,
  passo: string,
): Promise<{ ok: true; status: StatusDePedido } | { ok: false; erro: string }> {
  if (passo !== 'saiu' && passo !== 'entregue') return { ok: false, erro: 'Ação desconhecida.' }
  try {
    return await passoDoEntregador(token, passo satisfies PassoDoEntregador)
  } catch (erro) {
    console.error('[entregador] o passo não foi gravado', erro)
    return { ok: false, erro: 'Não foi possível atualizar o pedido. Tente de novo.' }
  }
}

/** O link do pedido, para a equipe copiar ou mandar ao motoboy. De quem mexe nos pedidos. */
export async function acaoLinkDoEntregador(
  clienteId: string,
  pedidoId: string,
): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer nos pedidos.' }
  const pedido = await acharPedido(clienteId, pedidoId)
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.' }
  if (pedido.status === 'cancelado' || pedido.status === 'entregue') return { ok: false, erro: 'Este pedido já foi encerrado.' }
  return { ok: true, link: `${ENDERECO_DO_ENTREGADOR}${criarTokenDoEntregador({ clienteId, pedidoId })}` }
}
