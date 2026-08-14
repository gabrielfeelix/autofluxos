import { z } from 'zod'
import { listarAlertasDeHandoff } from '@/server/repos/leads'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * Fonte curta para o polling do alerta nativo do Inbox.
 *
 * O `proxy` protege esta rota como as demais APIs do painel: sem cookie ou
 * Basic Auth válidos, ela devolve 401 antes de qualquer leitura. O payload não
 * inclui telefone, campos coletados, histórico ou segredo — só o necessário
 * para anunciar que alguém espera atendimento.
 */
export async function GET(_req: Request, contexto: RouteContext<'/api/clientes/[clienteId]/inbox/alertas'>) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  const alertas = await listarAlertasDeHandoff(params.data.clienteId)
  return Response.json(
    { alertas },
    {
      headers: {
        // Alerta atrasado é pior que ausência de alerta: esta rota sempre lê a
        // fila atual e nunca pode ser reaproveitada por navegador/CDN.
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  )
}
