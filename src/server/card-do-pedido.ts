import { linkDoRastreio, mensagemDoPedido } from '@/core/pedido-na-conversa'
import type { PedidoDaLoja } from '@/loja/magento-pedido'
import { lojaAtivaDaConta } from './adaptador-da-loja'
import { lojaDaConta } from './repos/lojas'

/**
 * O card do status do pedido: texto, foto do item principal e o botão. O
 * mesmo para quem atende pela Inbox e para o bot (`loja_pedido`): em 06/out
 * só a Inbox ganhou o card, e o bot seguiu escrevendo o status em texto livre,
 * com "está com a transportadora" ao lado de "Aguardando coleta".
 *
 * O botão leva ao rastreio da Frete Rápido quando o envio traz o código;
 * senão, à página de pedidos da loja, que pede login. Sem nenhum dos dois,
 * `link` vem `null` e quem manda decide (texto puro).
 */
export async function cardDoPedido(
  clienteId: string,
  pedido: PedidoDaLoja,
): Promise<{ texto: string; rotulo: string; link: string | null; foto: string | null }> {
  const texto = mensagemDoPedido(pedido)
  const rastreio = linkDoRastreio(pedido)
  if (rastreio) return { texto, rotulo: 'Rastrear entrega', link: rastreio, foto: await fotoDoPedido(clienteId, pedido) }

  const loja = await lojaDaConta(clienteId)
  const pagina = loja?.endereco ? `${loja.endereco.replace(/\/+$/, '')}/sales/order/history/` : null
  return { texto, rotulo: 'Ver meus pedidos', link: pagina, foto: pagina ? await fotoDoPedido(clienteId, pedido) : null }
}

/**
 * A foto do item principal do pedido (o primeiro), para o cabeçalho do card.
 *
 * Pelo SKU e, se a loja não devolver (o SKU do pedido de um configurável é o
 * da variação, que a busca da vitrine esconde), pelo nome exato. Nome
 * parecido não vale: foto de outro produto no pedido de alguém é pior que
 * card sem foto. Melhor-esforço: qualquer falha manda o card sem foto.
 */
async function fotoDoPedido(clienteId: string, pedido: PedidoDaLoja): Promise<string | null> {
  const item = pedido.itens[0]
  if (!item) return null
  try {
    const loja = await lojaAtivaDaConta(clienteId, 'loja')
    if (!loja) return null
    if (item.sku) {
      const r = await loja.lerPorSku([item.sku])
      const foto = r.ok ? r.valor.find((p) => p.foto)?.foto : undefined
      if (foto) return foto
    }
    const r = await loja.buscar(item.nome)
    const mesmo = (n: string) => n.trim().toLowerCase() === item.nome.trim().toLowerCase()
    return (r.ok ? r.valor.find((p) => mesmo(p.nome) && p.foto)?.foto : undefined) ?? null
  } catch {
    return null
  }
}
