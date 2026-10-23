import { after } from 'next/server'
import { avisoAutentico, clienteDoEndereco, pedidoDoAviso } from '@/channels/pagbank'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'

export const dynamic = 'force-dynamic'

/**
 * O aviso de pedido do PagBank, um endereço por organização, mandado em cada
 * pedido (`channels/pagbank.ts`). O id da organização vem em base64url porque
 * o PagBank não aceita endereço com mais de 100 caracteres.
 *
 * O `x-authenticity-token` não é conferido (relatos de falha, e depende de um
 * token da conta que não temos). A defesa é dupla: o `t` do endereço,
 * derivado do `BETTER_AUTH_SECRET` e do id da organização, conferido antes de
 * tocar o banco; e o pedido relido na API com o token do dono antes de a
 * cobrança mudar. Corpo forjado sem pedido pago de verdade não marca nada.
 *
 * Responde 200 mesmo quando o processamento falha: reenviar não conserta erro
 * nosso, e a falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ endereco: string }> }) {
  const clienteId = clienteDoEndereco((await params).endereco)
  if (!clienteId) return new Response('não encontrado', { status: 404 })
  if (!avisoAutentico(clienteId, new URL(req.url).searchParams.get('t'))) {
    return new Response('não autorizado', { status: 401 })
  }

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  let corpo: unknown
  try {
    corpo = JSON.parse(lido.corpo)
  } catch {
    return new Response('ok', { status: 200 })
  }

  const pedidoId = pedidoDoAviso(corpo)
  if (!pedidoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await aplicarPagamento(clienteId, 'pagbank', pedidoId)
    } catch (erro) {
      await alertar('o aviso de pagamento do PagBank falhou', erro, { cliente: clienteId })
    }
  })
  return new Response('ok', { status: 200 })
}
