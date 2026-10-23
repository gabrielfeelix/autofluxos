import { after } from 'next/server'
import { avisoDa4yuAutentico, notaDoAvisoDa4yu, pagamentoDoAvisoDa4yu } from '@/channels/asaas-da-4yu'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { alertar } from '@/server/alertar'
import { aplicarAvisoDaMensalidade, aplicarNotaDaMensalidade } from '@/server/mensalidade-da-4yu'

export const dynamic = 'force-dynamic'

/**
 * Os avisos da conta Asaas **da 4YU**: as faturas da mensalidade do
 * AutoFluxos (docs/PLANO-MENSALIDADE-ASAAS.md). Um endereço só, cadastrado
 * por `garantirAviso` na primeira assinatura.
 *
 * Mesmo desenho de `asaas/[clienteId]`: o `asaas-access-token` é conferido
 * antes de tocar o banco, o corpo só fornece o id do pagamento, e a fatura é
 * relida na API antes de o plano mudar. Responde 200 mesmo quando o
 * processamento falha, porque o Asaas pausa a fila depois de 15 falhas
 * seguidas; a falha vira alerta.
 */
export async function POST(req: Request) {
  if (!avisoDa4yuAutentico(req.headers.get('asaas-access-token'))) {
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

  const notaId = notaDoAvisoDa4yu(corpo)
  if (notaId) {
    after(async () => {
      try {
        await aplicarNotaDaMensalidade(notaId)
      } catch (erro) {
        await alertar('o aviso de nota fiscal da mensalidade falhou', erro, { nota: notaId })
      }
    })
    return new Response('ok', { status: 200 })
  }

  const asaasId = pagamentoDoAvisoDa4yu(corpo)
  if (!asaasId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await aplicarAvisoDaMensalidade(asaasId)
    } catch (erro) {
      await alertar('o aviso da mensalidade do Asaas falhou', erro, { fatura: asaasId })
    }
  })
  return new Response('ok', { status: 200 })
}
