import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { pedidoDoWebhookFoody } from '@/server/cardapios/foody'
import { webhookAutentico } from '@/server/cardapios/token-do-webhook'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'

export const dynamic = 'force-dynamic'

/**
 * O gatilho da Foody (`order_status_updated`), que o lojista cadastra em
 * Minha Conta > Configurações Avançadas > Criar Gatilho, com o token da tela
 * de conexão no campo de token. A Foody manda o token **no corpo**, não em
 * cabeçalho.
 *
 * Ao salvar o gatilho, a Foody testa a URL com `hook_test`: responde 200.
 * O corpo traz só o `uid`; o pedido é relido na API com o token da conta.
 *
 * **Responde 200 antes de processar e mesmo quando o processamento falha.**
 * A Foody desliga o gatilho depois de 10 erros seguidos; com ele desligado,
 * só a passada de 10 minutos segura os pedidos. A falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  let corpo: { event?: unknown; token?: unknown; uid?: unknown }
  try {
    corpo = JSON.parse(lido.corpo) as typeof corpo
  } catch {
    return new Response('corpo ilegível', { status: 400 })
  }
  // O teste da URL não move nada: responde 200 mesmo sem token, senão a Foody não salva o gatilho.
  if (corpo.event === 'hook_test') return new Response('ok', { status: 200 })
  if (!webhookAutentico(clienteId, 'foody', typeof corpo.token === 'string' ? corpo.token : null)) {
    return new Response('não autorizado', { status: 401 })
  }
  if (corpo.event !== 'order_status_updated') return new Response('ok', { status: 200 })
  const pedidoId = typeof corpo.uid === 'string' ? corpo.uid : ''
  if (!pedidoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await pedidoDoWebhookFoody(clienteId, pedidoId)
    } catch (erro) {
      await alertar('O gatilho da Foody falhou', erro, { cliente: clienteId, pedido: pedidoId })
    }
  })
  return new Response('ok', { status: 200 })
}
