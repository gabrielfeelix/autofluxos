import { after } from 'next/server'
import { avisoAutentico, pagamentoDoAviso } from '@/channels/asaas'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'

export const dynamic = 'force-dynamic'

/**
 * Os avisos de pagamento do Asaas, um endereço por organização (o webhook é
 * criado na conta do dono quando ele conecta a chave, `channels/asaas.ts`).
 *
 * A defesa é o `asaas-access-token`, derivado do `BETTER_AUTH_SECRET` e do id
 * da organização, conferido **antes** de tocar o banco. O corpo não é prova de
 * nada: só o id do pagamento sai dele, e o pagamento é relido na API com a
 * chave do dono antes de a cobrança mudar.
 *
 * **Responde 200 mesmo quando o processamento falha.** O Asaas pausa a fila
 * inteira da conta depois de 15 falhas seguidas, e com a fila parada nenhum
 * pagamento chega mais. A falha vira alerta, e o relógio do vencimento relê o
 * pagamento antes de vencer: é a rede de segurança do aviso perdido.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })
  if (!avisoAutentico(clienteId, req.headers.get('asaas-access-token'))) {
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
      await aplicarPagamento(clienteId, 'asaas', pagamentoId)
    } catch (erro) {
      await alertar('o aviso de pagamento do Asaas falhou', erro, { cliente: clienteId })
    }
  })
  return new Response('ok', { status: 200 })
}
