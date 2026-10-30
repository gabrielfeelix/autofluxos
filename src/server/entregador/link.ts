import 'server-only'
import { AUTOR_AUTOMACAO } from '@/core/autor-da-mensagem'
import type { StatusDePedido } from '@/core/pedidos'
import { podeAvancar } from '@/core/pedidos-de-fora'
import { moverPedido } from '../pedidos'
import { acharCliente } from '../repos/clientes'
import { acharContato } from '../repos/conversas'
import { acharPedido, type Pedido } from '../repos/pedidos'
import { lerTokenDoEntregador } from './token'

export const ENDERECO_DO_ENTREGADOR = 'https://dialogon.com.br/e/'

export type PassoDoEntregador = 'saiu' | 'entregue'

export type PedidoDoEntregador =
  | { ok: true; pedido: Pedido; loja: string; cliente: string | null }
  | { ok: false; motivo: 'invalido' | 'vencido' | 'sumiu' }

/** O pedido do link, para a página do motoboy. Link adulterado e pedido apagado dão o mesmo "não encontrado". */
export async function pedidoDoEntregador(token: string): Promise<PedidoDoEntregador> {
  const lido = lerTokenDoEntregador(token)
  if (!lido.ok) return lido
  const [pedido, conta] = await Promise.all([
    acharPedido(lido.dados.clienteId, lido.dados.pedidoId),
    acharCliente(lido.dados.clienteId),
  ])
  if (!pedido) return { ok: false, motivo: 'sumiu' }
  const contato = pedido.contatoId ? await acharContato(pedido.contatoId) : null
  return { ok: true, pedido, loja: conta?.nome ?? '', cliente: contato?.nomeReal || contato?.nome || pedido.nomeCliente }
}

/**
 * O toque do motoboy: "Saí para entregar" ou "Entreguei".
 *
 * Move pelo mesmo `moverPedido` da tela, então o cliente é avisado do mesmo
 * jeito (na conversa ou pelo modelo). Repetir o toque não avisa de novo: a
 * etapa que já passou devolve ok sem mover. Pedido cancelado não anda.
 */
export async function passoDoEntregador(
  token: string,
  passo: PassoDoEntregador,
): Promise<{ ok: true; status: StatusDePedido } | { ok: false; erro: string }> {
  const lido = lerTokenDoEntregador(token)
  if (!lido.ok) {
    return { ok: false, erro: lido.motivo === 'vencido' ? 'Este link venceu. Peça um novo à loja.' : 'Link inválido. Peça um novo à loja.' }
  }
  const { clienteId, pedidoId } = lido.dados
  const pedido = await acharPedido(clienteId, pedidoId)
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado. Fale com a loja.' }
  if (pedido.status === 'cancelado') return { ok: false, erro: 'Este pedido foi cancelado. Fale com a loja.' }
  if (pedido.status === passo || pedido.status === 'entregue') return { ok: true, status: pedido.status }
  if (!podeAvancar(pedido.status, passo)) return { ok: true, status: pedido.status }

  const r = await moverPedido(clienteId, pedidoId, passo, AUTOR_AUTOMACAO)
  if (!r.ok) {
    // Outro toque (ou a loja) moveu no meio: vale o que está gravado.
    const agora = await acharPedido(clienteId, pedidoId)
    if (agora && (agora.status === passo || agora.status === 'entregue')) return { ok: true, status: agora.status }
    return { ok: false, erro: 'Não foi possível atualizar o pedido. Tente de novo.' }
  }
  return { ok: true, status: r.pedido.status }
}
