import { alertar } from '@/server/alertar'
import { db } from '@/server/db'
import { preencherFotosPendentes } from '@/server/foto-do-contato'
import { iguais } from '@/lib/segredo'

/**
 * Uma vez por dia: as fotos de perfil que faltam em toda conta com Instagram
 * ou Messenger. O Inbox também preenche ao abrir; isto cobre a conta que
 * ninguém abriu.
 */
export const dynamic = 'force-dynamic'

export const maxDuration = 60

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json({ erro: 'CRON_SECRET não configurado; a passada das fotos não roda sem ele' }, { status: 503 })
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    const { data } = await db()
      .from('channels')
      .select('client_id')
      .in('provider', ['instagram', 'messenger'])
      .eq('status', 'ativo')
    const contas = [...new Set(((data ?? []) as { client_id: string }[]).map((c) => c.client_id))]
    let fotos = 0
    for (const conta of contas) fotos += await preencherFotosPendentes(conta, 40)
    return Response.json({ contas: contas.length, fotos })
  } catch (erro) {
    await alertar('a passada das fotos de perfil falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
