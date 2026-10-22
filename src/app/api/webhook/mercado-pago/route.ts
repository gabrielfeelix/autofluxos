import { after } from 'next/server'
import { assinaturaDoAvisoValida, pagamentoDoAviso } from '@/channels/mercado-pago'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'
import { clienteDaContaNoGateway } from '@/server/repos/pagamentos'

export const dynamic = 'force-dynamic'

/**
 * Os avisos de pagamento do Mercado Pago (cobrança no chat, etapa B).
 *
 * Um endereço só, cadastrado em "Webhooks" na aplicação da 4YU: o Mercado Pago
 * avisa ali de todas as contas conectadas, e o `user_id` do corpo diz de qual.
 *
 * Duas defesas, nesta ordem: o `x-signature` com a assinatura secreta da
 * aplicação (falha fechada sem `MERCADO_PAGO_WEBHOOK_SECRET`), e a releitura
 * do pagamento na API com o token **daquela** conta. Um aviso que mente o
 * `user_id` relê com o token errado e não acha cobrança nenhuma.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id')
  if (
    !assinaturaDoAvisoValida({
      assinatura: req.headers.get('x-signature'),
      requisicao: req.headers.get('x-request-id'),
      dataId,
    })
  ) {
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

  const aviso = pagamentoDoAviso(corpo)
  // O id assinado é o da URL; o do corpo precisa ser o mesmo, senão a
  // assinatura não cobre o pagamento que vamos reler.
  if (!aviso || dataId !== aviso.pagamentoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      const clienteId = await clienteDaContaNoGateway('mercado_pago', aviso.contaId)
      if (clienteId) await aplicarPagamento(clienteId, 'mercado_pago', aviso.pagamentoId)
    } catch (erro) {
      await alertar('o aviso de pagamento do Mercado Pago falhou', erro, { conta: aviso.contaId })
    }
  })
  return new Response('ok', { status: 200 })
}
