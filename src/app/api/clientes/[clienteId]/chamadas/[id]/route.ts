import { z } from 'zod'
import { atender, encerrarPeloAtendente, estadoParaAtendente, recusar, servidoresIce, TETO_DO_SDP } from '@/server/chamadas'
import { exigirCapacidade, recusou } from '@/server/permissoes'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid(), id: z.string().uuid() })

/**
 * Uma ligação, do lado de quem atende. 404 para tudo que não é da conta, como
 * nas rotas vizinhas: confirmar que existe já é contar de outro cliente.
 */
export async function GET(_req: Request, contexto: { params: Promise<{ clienteId: string; id: string }> }) {
  const p = paramsSchema.safeParse(await contexto.params)
  if (!p.success) return Response.json({ erro: 'inválido' }, { status: 400 })
  const acesso = await exigirCapacidade(p.data.clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const estado = await estadoParaAtendente(p.data.clienteId, p.data.id)
  if (!estado) return Response.json({ erro: 'não encontrado' }, { status: 404 })
  return Response.json({ ...estado, iceServers: servidoresIce() }, { headers: { 'cache-control': 'no-store' } })
}

const corpoSchema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('atender'), resposta: z.string().min(10).max(TETO_DO_SDP) }),
  z.object({ acao: z.literal('recusar') }),
  z.object({ acao: z.literal('encerrar') }),
])

export async function POST(req: Request, contexto: { params: Promise<{ clienteId: string; id: string }> }) {
  const p = paramsSchema.safeParse(await contexto.params)
  if (!p.success) return Response.json({ erro: 'inválido' }, { status: 400 })
  const acesso = await exigirCapacidade(p.data.clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!corpo.success) return Response.json({ erro: 'inválido' }, { status: 400 })

  const { clienteId, id } = p.data
  if (corpo.data.acao === 'atender') {
    const quem = await sessaoAtual()
    const levou = await atender(clienteId, id, corpo.data.resposta, quem?.usuario.id ?? null)
    return levou ? Response.json({ ok: true }) : Response.json({ erro: 'Outra pessoa já atendeu, ou a ligação caiu.' }, { status: 409 })
  }
  if (corpo.data.acao === 'recusar') await recusar(clienteId, id)
  else await encerrarPeloAtendente(clienteId, id)
  return Response.json({ ok: true })
}
