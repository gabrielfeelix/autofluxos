import { after } from 'next/server'
import { lerAvisoDaGreenn } from '@/core/greenn'
import { alertar } from '@/server/alertar'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { greennAutentico, tratarVendaDaGreenn } from '@/server/greenn'
import { consumirLimite } from '@/server/limite'
import { recursoLiberado } from '@/server/recursos-do-plano'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * O webhook da Greenn (`saleUpdated`), que o vendedor cola no produto:
 * Produtos, editar, Conteúdos, Sistema externo, Entrega por webhook.
 *
 * A Greenn não assina o corpo, então o segredo é o `?token=` do endereço
 * (`tokenDaGreenn`). O resto segue o webhook de entrada: teto de corpo, limite
 * por conta, plano com `webhook`, e **200 antes de processar**, porque a Greenn
 * reenviaria e uma falha nossa não é dela. A falha vira alerta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return new Response('não encontrado', { status: 404 })

  const lido = await lerCorpoComTeto(req, 64 * 1024)
  if (!lido.ok) return lido.resposta

  if (!(await consumirLimite(`webhook-greenn:${clienteId}`, 120, 60))) {
    return Response.json({ erro: 'muitas chamadas' }, { status: 429 })
  }

  const token = new URL(req.url).searchParams.get('token')
  if (!greennAutentico(clienteId, token)) return Response.json({ erro: 'não autorizado' }, { status: 401 })

  if (!(await recursoLiberado(clienteId, 'webhook'))) {
    return Response.json({ erro: 'o plano da organização não inclui webhook de entrada' }, { status: 403 })
  }

  let corpo: unknown
  try {
    corpo = JSON.parse(lido.corpo)
  } catch {
    return Response.json({ erro: 'corpo não é JSON' }, { status: 400 })
  }

  const venda = lerAvisoDaGreenn(corpo)
  if (!venda) return Response.json({ ok: true, ignorado: true }, { status: 200 })

  after(async () => {
    try {
      await tratarVendaDaGreenn(clienteId, venda)
    } catch (erro) {
      console.error('[greenn] falhou ao processar', erro)
      await alertar('o aviso da Greenn falhou', erro, { cliente: clienteId, venda: venda.vendaId })
    }
  })
  return Response.json({ ok: true }, { status: 200 })
}
