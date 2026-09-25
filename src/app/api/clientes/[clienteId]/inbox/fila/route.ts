import { z } from 'zod'
import { leadsMudadosDesde, pulsoDaConta } from '@/server/repos/leads'
import { naoLidasPorContato } from '@/server/repos/leituras'
import { alcanceDeConversas, exigirCapacidade, recusou } from '@/server/permissoes'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * As linhas da fila que mudaram desde `desde`, para o Inbox trocar só elas.
 *
 * Vem com as não lidas de cada uma e o pulso atual, que é o que a tela passa a
 * considerar "já visto". Mesmo portão da rota do pulso: 404 para quem não
 * atende nesta conta, e cada linha passa pelo alcance de quem pede.
 */
export async function GET(req: Request, contexto: { params: Promise<{ clienteId: string }> }) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  const desde = new URL(req.url).searchParams.get('desde') ?? ''
  if (Number.isNaN(Date.parse(desde))) return Response.json({ erro: 'desde inválido' }, { status: 400 })

  const acesso = await exigirCapacidade(params.data.clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const clienteId = params.data.clienteId
  const [{ leads, completo }, pulso] = await Promise.all([
    leadsMudadosDesde(clienteId, new Date(desde).toISOString(), await alcanceDeConversas(clienteId, acesso)),
    pulsoDaConta(clienteId),
  ])
  const naoLidas = await naoLidasPorContato(
    acesso.sessao.usuario.id ?? null,
    leads.map((lead) => lead.contatoId),
  )

  return Response.json(
    { leads, naoLidas: Object.fromEntries(naoLidas), pulso, completo },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
