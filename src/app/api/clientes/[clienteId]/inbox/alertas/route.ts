import { z } from 'zod'
import { listarAlertasDeHandoff } from '@/server/repos/leads'
import { conferirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * Fonte curta para o polling do alerta nativo do Inbox.
 *
 * O `proxy` recusa quem não tem sessão nenhuma antes de qualquer leitura. Quem
 * tem sessão ainda precisa ser **desta conta**, e é isso que a conferência
 * abaixo faz: com o login por usuário, "tem cookie" deixou de significar "pode
 * ver tudo". O payload não inclui telefone, campos coletados, histórico ou
 * segredo — só o necessário para anunciar que alguém espera atendimento.
 */
export async function GET(_req: Request, contexto: RouteContext<'/api/clientes/[clienteId]/inbox/alertas'>) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  // 404 e não 403: confirmar que a conta existe já é contar de um cliente para
  // quem não é dele.
  if (!(await conferirAcessoAoCliente(params.data.clienteId))) {
    return Response.json({ erro: 'não encontrado' }, { status: 404 })
  }

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
