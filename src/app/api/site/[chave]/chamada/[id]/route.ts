import { z } from 'zod'
import { abrirPorta, preflight, responder, segredoDoPedido } from '@/server/api-do-site'
import { encerrarPeloVisitante, estadoParaVisitante } from '@/server/chamadas'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ chave: string; id: string }> }

const id = z.string().uuid()

/** Em que pé está a ligação, e a resposta do atendente quando ele atender. */
export async function GET(req: Request, { params }: Contexto) {
  const p = await params
  const porta = await abrirPorta(req, p.chave, 'leitura')
  if (!porta.ok) return porta.resposta
  const segredo = segredoDoPedido(req)
  if (!segredo || !id.safeParse(p.id).success) return responder(porta.origem, { erro: 'inválido' }, 400)

  const estado = await estadoParaVisitante(porta.canal, segredo, p.id)
  return estado ? responder(porta.origem, estado) : responder(porta.origem, { erro: 'não encontrada' }, 404)
}

/** Desligar. Antes de atenderem, vira chamada perdida. */
export async function POST(req: Request, { params }: Contexto) {
  const p = await params
  const porta = await abrirPorta(req, p.chave, 'envio')
  if (!porta.ok) return porta.resposta
  const segredo = segredoDoPedido(req)
  if (!segredo || !id.safeParse(p.id).success) return responder(porta.origem, { erro: 'inválido' }, 400)

  await encerrarPeloVisitante(porta.canal, segredo, p.id)
  return responder(porta.origem, { ok: true })
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
