import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { pedidoDoWebhookOlaClick, webhookDaOlaClickAutentico } from '@/server/cardapios/olaclick'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'

export const dynamic = 'force-dynamic'

/**
 * O webhook da OlaClick (`ORDER_CREATED`, `ORDER_UPDATED`), que nós mesmos
 * registramos na API ao conectar a conta.
 *
 * A assinatura (`X-OlaClick-Signature`, HMAC do corpo cru) é conferida com o
 * segredo que a OlaClick devolveu no registro. Mesmo assim o pedido é relido
 * na API com a chave da conta: o `data` da entrega é aviso, e retentativa
 * atrasada não pode atropelar o estado de agora.
 *
 * **Responde 200 antes de processar e mesmo quando o processamento falha.**
 * Esgotadas as retentativas a OlaClick não reenvia, e só a passada de 10
 * minutos segura o pedido. A falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  if (!(await webhookDaOlaClickAutentico(clienteId, lido.corpo, req.headers.get('x-olaclick-signature')))) {
    return new Response('não autorizado', { status: 401 })
  }

  let corpo: { event_type?: unknown; data?: { id?: unknown } | null }
  try {
    corpo = JSON.parse(lido.corpo) as typeof corpo
  } catch {
    return new Response('ok', { status: 200 })
  }
  if (corpo.event_type !== 'ORDER_CREATED' && corpo.event_type !== 'ORDER_UPDATED') return new Response('ok', { status: 200 })
  const pedidoId = typeof corpo.data?.id === 'string' ? corpo.data.id : ''
  if (!pedidoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await pedidoDoWebhookOlaClick(clienteId, pedidoId)
    } catch (erro) {
      await alertar('O webhook da OlaClick falhou', erro, { cliente: clienteId, pedido: pedidoId })
    }
  })
  return new Response('ok', { status: 200 })
}
