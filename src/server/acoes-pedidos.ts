'use server'

import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { ehStatusDePedido, type StatusDePedido } from '@/core/pedidos'
import { cancelarCobranca } from './cobrancas'
import { cartoesDosPedidos, moverPedido, type CartaoDePedido } from './pedidos'
import { exigirCapacidade, recusou } from './permissoes'
import { acharCobranca } from './repos/cobrancas'

/**
 * A tela Pedidos (0146).
 *
 * Mover de etapa é de quem atende (`atender`): no restaurante é a cozinha e o
 * balcão que andam com o pedido. Cancelar pede `registrar_venda`, como
 * cancelar cobrança, porque desfaz uma venda.
 */

/** A lista de agora, para a tela se atualizar sozinha enquanto está aberta. */
export async function acaoListarPedidos(clienteId: string): Promise<CartaoDePedido[] | null> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return null
  const valores = await exigirCapacidade(clienteId, 'ler_valores', 'proprios')
  return cartoesDosPedidos(clienteId, !recusou(valores))
}

export async function acaoMoverPedido(
  clienteId: string,
  pedidoId: string,
  para: string,
): Promise<{ ok: true; status: StatusDePedido; avisado: boolean } | { ok: false; erro: string }> {
  if (!ehStatusDePedido(para)) return { ok: false, erro: 'Etapa desconhecida.' }
  const acesso = await exigirCapacidade(clienteId, para === 'cancelado' ? 'registrar_venda' : 'atender', 'proprios')
  if (recusou(acesso)) {
    return { ok: false, erro: para === 'cancelado' ? 'Sua função não permite cancelar pedido.' : 'Sua função não permite mexer nos pedidos.' }
  }
  const autor = autorDaPessoa(acesso.sessao.usuario)
  const r = await moverPedido(clienteId, pedidoId, para, autor)
  if (!r.ok) return r

  // Cancelado antes de pagar: o Pix também deixa de valer.
  if (para === 'cancelado' && r.pedido.cobrancaId) {
    const cobranca = await acharCobranca(clienteId, r.pedido.cobrancaId)
    if (cobranca?.status === 'pendente') {
      await cancelarCobranca(clienteId, cobranca.id, acesso.sessao.usuario.nome?.trim() || null).catch(() => undefined)
    }
  }
  return { ok: true, status: r.pedido.status, avisado: r.avisado }
}
