import { after } from 'next/server'
import { avisoAutentico } from '@/channels/aviso-por-endereco'
import { alertar } from '@/server/alertar'
import { aplicarPagamento } from '@/server/cobrancas'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { gatewayPorCampos } from '@/server/gateways-por-campos'

export const dynamic = 'force-dynamic'

/**
 * O aviso de pago dos gateways de credencial colada (Woovi, PagHiper, Efí,
 * Iugu, Pagar.me), um endereço por gateway e por organização
 * (`channels/aviso-por-endereco.ts`).
 *
 * Nenhum deles assina o aviso de um jeito que sirva aqui. A defesa é dupla: o
 * `t` do endereço, conferido **antes** de tocar o banco; e o pagamento relido
 * na API com o acesso do dono antes de a cobrança mudar. Corpo forjado sem
 * pagamento de verdade não marca nada.
 *
 * O corpo vem em JSON (Woovi, Efí, Pagar.me) ou em formulário (PagHiper,
 * Iugu). Responde 200 sempre que o endereço é autêntico: reenviar não conserta
 * erro nosso, e a Woovi e a Efí testam o endereço no cadastro com um corpo que
 * não é pagamento nenhum.
 */
export async function POST(req: Request, { params }: { params: Promise<{ gateway: string; clienteId: string }> }) {
  const { gateway: nome, clienteId } = await params
  const achado = gatewayPorCampos(nome)
  if (!achado || !/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })
  if (!avisoAutentico(achado.gateway, clienteId, new URL(req.url).searchParams.get('t'))) {
    return new Response('não autorizado', { status: 401 })
  }

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  const pagamentoId = achado.config.pagamentoDoAviso(lerCorpo(lido.corpo, req.headers.get('content-type')))
  if (!pagamentoId) return new Response('ok', { status: 200 })

  after(async () => {
    try {
      await aplicarPagamento(clienteId, achado.gateway, pagamentoId)
    } catch (erro) {
      await alertar(`o aviso de pagamento do gateway ${achado.gateway} falhou`, erro, { cliente: clienteId })
    }
  })
  return new Response('ok', { status: 200 })
}

function lerCorpo(texto: string, tipo: string | null): unknown {
  if (tipo?.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(texto))
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}
