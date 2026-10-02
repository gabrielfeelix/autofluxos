import { alertar } from '@/server/alertar'
import { iguais } from '@/lib/segredo'
import { limparIdempotenciaVencida } from '@/server/repos/idempotencia-da-api'
import { processarEntregas } from '@/server/webhooks-de-saida'

export const dynamic = 'force-dynamic'

/** Cada entrega espera até 10 s pelo destino; 50 em paralelo cabem em 60. */
export const maxDuration = 60

/**
 * O piso dos webhooks de saída, chamado pelo cron diário da Vercel.
 *
 * Exige `CRON_SECRET` e **falha fechada sem ele**, como as outras rotas de
 * manutenção. Não é o caminho principal: a primeira tentativa sai no `after()`
 * da emissão, e as novas tentativas pegam carona no webhook do WhatsApp e no
 * pulso do Inbox (ver `server/webhooks-de-saida.ts`). Esta rota cobre a conta
 * que passou o dia sem nada disso, e limpa as `Idempotency-Key` vencidas.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return Response.json({ erro: 'CRON_SECRET não configurado; a passada dos webhooks não roda sem ele' }, { status: 503 })
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!iguais(informado, segredo)) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    const entregas = await processarEntregas(50)
    const idempotencia = await limparIdempotenciaVencida().catch((erro) => {
      console.error('[manutencao] limpar idempotência falhou:', erro instanceof Error ? erro.message : erro)
      return null
    })
    return Response.json({ entregas, idempotenciaApagada: idempotencia })
  } catch (erro) {
    await alertar('a passada dos webhooks de saída falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
