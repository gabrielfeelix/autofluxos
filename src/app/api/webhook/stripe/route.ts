import { after } from 'next/server'
import { assinaturaValida, eventoDoAviso } from '@/channels/stripe'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { apagarConexaoDePagamento, clienteDaContaNoGateway } from '@/server/repos/pagamentos'

export const dynamic = 'force-dynamic'

/**
 * O aviso do Stripe Connect: um endpoint só para todas as contas conectadas,
 * assinado com `STRIPE_WEBHOOK_SECRET` (`channels/stripe.ts`).
 *
 * A assinatura é conferida no corpo bruto **antes** de tocar o banco, e falha
 * fechada sem o segredo. O evento diz a conta (`account`); a organização é a
 * que ligou essa conta, e o PaymentIntent ou a sessão é relido antes de a
 * cobrança mudar. O dono que desautoriza o app no Stripe desliga a conexão
 * aqui também.
 */
export async function POST(req: Request) {
  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  if (!assinaturaValida(lido.corpo, req.headers.get('stripe-signature'))) return new Response('não autorizado', { status: 401 })

  let corpo: unknown
  try {
    corpo = JSON.parse(lido.corpo)
  } catch {
    return new Response('ok', { status: 200 })
  }
  const evento = eventoDoAviso(corpo)
  if (!evento) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      const clienteId = await clienteDaContaNoGateway('stripe', evento.conta)
      if (!clienteId) return
      if (evento.tipo === 'account.application.deauthorized') {
        await apagarConexaoDePagamento(clienteId, 'stripe')
        return
      }
      if (evento.objetoId && /^(payment_intent|checkout\.session)\./.test(evento.tipo)) {
        await aplicarPagamento(clienteId, 'stripe', evento.objetoId)
      }
    } catch (erro) {
      await alertar('o aviso de pagamento do Stripe falhou', erro, { conta: evento.conta })
    }
  })
  return new Response('ok', { status: 200 })
}
