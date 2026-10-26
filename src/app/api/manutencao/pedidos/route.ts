import { iguais } from '@/lib/segredo'
import { acompanharPedidos } from '@/server/acompanhar-pedidos'
import { alertar } from '@/server/alertar'

export const dynamic = 'force-dynamic'

/** Cada conta é uma ida à loja e, por pedido novo, um envio pela Cloud API. */
export const maxDuration = 60

/**
 * O status dos pedidos da loja virando evento (0153), a cada 10 minutos.
 *
 * Quem chama é o GitHub Actions (`.github/workflows/pedidos-da-loja.yml`), e
 * não o cron da Vercel: no plano Hobby ele só roda uma vez por dia, e "o
 * pedido foi aprovado" avisado no dia seguinte não é pesquisa pós-compra. Ver
 * docs/DECISIONS.md, 26/out/2026.
 *
 * Fica fora do `proxy` e **falha fechada**, como `tarefas`: aceita o
 * `CRON_SECRET` da Vercel ou o `AGENDADOR_SEGREDO` do disparador externo, e
 * sem nenhum dos dois configurado não roda.
 */
export async function GET(req: Request) {
  const segredos = [process.env.CRON_SECRET, process.env.AGENDADOR_SEGREDO].filter((s): s is string => !!s)
  if (segredos.length === 0) {
    return Response.json({ erro: 'nenhum segredo de agendador configurado' }, { status: 503 })
  }

  const informado = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!segredos.some((s) => iguais(informado, s))) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    return Response.json(await acompanharPedidos())
  } catch (erro) {
    await alertar('a passada dos pedidos da loja falhou', erro)
    return Response.json({ erro: 'a passada falhou' }, { status: 500 })
  }
}
