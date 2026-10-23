import { after } from 'next/server'
import { avisoAutentico, pagamentoDoAviso } from '@/channels/infinitepay'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'

export const dynamic = 'force-dynamic'

/**
 * O aviso de pago da InfinitePay, um endereço por organização, mandado em
 * cada link (`channels/infinitepay.ts`).
 *
 * A InfinitePay não assina o aviso. A defesa é dupla: o `t` do endereço,
 * derivado do `BETTER_AUTH_SECRET` e do id da organização, conferido antes de
 * tocar o banco; e o `payment_check`, que relê o pagamento na InfinitePay
 * antes de a cobrança mudar. Corpo forjado sem uma transação paga de verdade
 * não marca nada.
 *
 * Responde 200 mesmo quando o processamento falha: a InfinitePay só reenvia
 * em 400, e reenviar não conserta erro nosso. A falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })
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

  const pagamentoId = pagamentoDoAviso(corpo)
  if (!pagamentoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await aplicarPagamento(clienteId, 'infinitepay', pagamentoId)
    } catch (erro) {
      await alertar('o aviso de pagamento da InfinitePay falhou', erro, { cliente: clienteId })
    }
  })
  return new Response('ok', { status: 200 })
}
