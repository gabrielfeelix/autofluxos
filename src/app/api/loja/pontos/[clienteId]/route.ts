import { z } from 'zod'
import { creditarPontosDaPesquisa } from '@/server/pontos-da-loja'

/**
 * Onde o nó de API do fim da pesquisa pós-compra pede os pontos de fidelidade.
 *
 * Pública como o webhook de entrada, e por isso sem confiar em nada do corpo:
 * só credita um par pedido + cliente que tem pesquisa aberta nesta conta, uma
 * vez por pedido (`server/pontos-da-loja.ts`). O teto de pontos fica aqui, e
 * não no desenho: um nó editado com um zero a mais não vira 2.500 pontos.
 */

const TETO_DE_PONTOS = 1000

const corpoSchema = z.object({
  pedido: z.string().trim().regex(/^[\w-]{1,40}$/),
  customer_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{1,12}$/)),
  pontos: z.coerce.number().int().min(1).max(TETO_DE_PONTOS),
})

export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return Response.json({ erro: 'conta inválida' }, { status: 404 })
  if (Number(req.headers.get('content-length') ?? '0') > 4096) {
    return Response.json({ erro: 'corpo grande demais' }, { status: 413 })
  }

  let bruto: unknown
  try {
    bruto = await req.json()
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 })
  }
  const corpo = corpoSchema.safeParse(bruto)
  if (!corpo.success) return Response.json({ erro: 'espera { pedido, customer_id, pontos }' }, { status: 400 })

  const r = await creditarPontosDaPesquisa(clienteId, corpo.data.pedido, corpo.data.customer_id, corpo.data.pontos)
  if (r === 'creditado' || r === 'ja_creditado') return Response.json({ ok: true, resultado: r })
  if (r === 'sem_pesquisa') return Response.json({ erro: 'nenhuma pesquisa aberta para este pedido' }, { status: 404 })
  return Response.json({ erro: 'não foi possível lançar os pontos' }, { status: 502 })
}
