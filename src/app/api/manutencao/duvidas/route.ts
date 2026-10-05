import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { passadaDasDuvidas } from '@/server/duvidas'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

/**
 * A passada diária das dúvidas do atendimento. Ver `server/duvidas.ts`.
 * Mesma porta das outras manutenções: só com o `CRON_SECRET`.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json({ erro: 'CRON_SECRET não configurado; a passada das dúvidas não roda sem ele' }, { status: 503 })
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    return Response.json(await passadaDasDuvidas())
  } catch (erro) {
    await alertar('a passada das dúvidas falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
