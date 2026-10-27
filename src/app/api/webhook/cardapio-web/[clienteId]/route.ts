import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { pedidoDoWebhookCardapioWeb } from '@/server/cardapios/cardapio-web'
import { webhookAutentico } from '@/server/cardapios/token-do-webhook'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'

export const dynamic = 'force-dynamic'

/**
 * O webhook do Cardápio Web (`ORDER_CREATED`, `ORDER_STATUS_UPDATED`), que o
 * lojista cadastra no Portal com o token da tela de conexão no
 * `X-Webhook-Token`.
 *
 * O payload traz só `order_id` e `merchant_id`; o pedido é relido na API com a
 * chave da conta, então um corpo forjado não move nada sozinho.
 *
 * **Responde 200 antes de processar e mesmo quando o processamento falha.**
 * O Cardápio Web exige resposta em 5 segundos e pausa o webhook depois de 15
 * falhas seguidas; com ele pausado, só a passada de 10 minutos segura os
 * pedidos. A falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })
  if (!webhookAutentico(clienteId, 'cardapio_web', req.headers.get('x-webhook-token'))) {
    return new Response('não autorizado', { status: 401 })
  }

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  let corpo: { order_id?: unknown; merchant_id?: unknown }
  try {
    corpo = JSON.parse(lido.corpo) as typeof corpo
  } catch {
    return new Response('ok', { status: 200 })
  }
  const pedidoId = typeof corpo.order_id === 'number' || typeof corpo.order_id === 'string' ? String(corpo.order_id) : ''
  if (!pedidoId) return new Response('ok', { status: 200 })
  const lojaId = corpo.merchant_id === undefined || corpo.merchant_id === null ? null : String(corpo.merchant_id)

  after(async () => {
    try {
      await pedidoDoWebhookCardapioWeb(clienteId, pedidoId, lojaId)
    } catch (erro) {
      await alertar('O webhook do Cardápio Web falhou', erro, { cliente: clienteId, pedido: pedidoId })
    }
  })
  return new Response('ok', { status: 200 })
}
