import { z } from 'zod'
import { abrirPorta, preflight, responder, segredoDoPedido } from '@/server/api-do-site'
import { iniciarChamada, servidoresIce, TETO_DO_SDP } from '@/server/chamadas'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ chave: string }> }

/** Os servidores ICE, pedidos antes de montar a oferta. */
export async function GET(req: Request, { params }: Contexto) {
  const porta = await abrirPorta(req, (await params).chave, 'leitura')
  if (!porta.ok) return porta.resposta
  return responder(porta.origem, { iceServers: servidoresIce() })
}

const corpoSchema = z.object({ oferta: z.string().min(10).max(TETO_DO_SDP) })

/** O visitante ligou: grava a oferta e faz o Inbox tocar. Ver `server/chamadas.ts`. */
export async function POST(req: Request, { params }: Contexto) {
  const porta = await abrirPorta(req, (await params).chave, 'envio')
  if (!porta.ok) return porta.resposta

  const segredo = segredoDoPedido(req)
  if (!segredo) return responder(porta.origem, { erro: 'visitante inválido' }, 400)

  const analise = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!analise.success) return responder(porta.origem, { erro: 'ligação inválida' }, 400)

  const r = await iniciarChamada(porta.canal, segredo, analise.data.oferta)
  return r.ok ? responder(porta.origem, { id: r.id }, 201) : responder(porta.origem, { erro: r.motivo }, 400)
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
