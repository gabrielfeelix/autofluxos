import { z } from 'zod'
import { executar } from '@/core/engine/executar'
import { entradaSchema, sessaoSchema } from '@/core/engine/types'
import { fluxoSchema } from '@/core/flow/schema'

/**
 * Roda o motor sem WhatsApp nenhum.
 *
 * O endpoint é **sem estado**: quem guarda a sessão é o navegador, que devolve
 * ela a cada mensagem. Isso não é atalho de MVP — é o que a pureza do motor
 * permite. O webhook do WhatsApp vai chamar exatamente a mesma `executar()`,
 * mudando só de onde vem a sessão (banco, em vez do corpo da requisição).
 */

const corpoSchema = z.object({
  fluxo: fluxoSchema,
  sessao: sessaoSchema,
  entrada: entradaSchema,
})

export async function POST(req: Request) {
  let bruto: unknown
  try {
    bruto = await req.json()
  } catch {
    return Response.json({ erro: 'corpo não é JSON válido' }, { status: 400 })
  }

  const analise = corpoSchema.safeParse(bruto)
  if (!analise.success) {
    return Response.json(
      { erro: 'requisição inválida', detalhes: analise.error.issues },
      { status: 400 },
    )
  }

  const { fluxo, sessao, entrada } = analise.data
  return Response.json(executar(fluxo, sessao, entrada))
}
