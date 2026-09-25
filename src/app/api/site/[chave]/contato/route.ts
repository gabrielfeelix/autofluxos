import { z } from 'zod'
import { abrirPorta, preflight, responder, segredoDoPedido } from '@/server/api-do-site'
import { identificarVisitante } from '@/server/receber-do-site'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ chave: string }> }

const corpoSchema = z.object({
  nome: z.string().max(120),
  contato: z.string().max(160),
})

/** O visitante disse o nome e um WhatsApp ou e-mail. Ver `identificarVisitante`. */
export async function POST(req: Request, { params }: Contexto) {
  const { chave } = await params
  const porta = await abrirPorta(req, chave, 'envio')
  if (!porta.ok) return porta.resposta

  const segredo = segredoDoPedido(req)
  if (!segredo) return responder(porta.origem, { erro: 'visitante inválido' }, 400)

  const analise = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!analise.success) return responder(porta.origem, { erro: 'dados inválidos' }, 400)

  const resultado = await identificarVisitante(porta.canal, segredo, analise.data)
  return resultado.ok
    ? responder(porta.origem, { ok: true })
    : responder(porta.origem, { erro: resultado.motivo }, 400)
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
