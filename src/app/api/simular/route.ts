import { z } from 'zod'
import { entradaSchema, sessaoSchema } from '@/core/engine/types'
import { fluxoSchema } from '@/core/flow/schema'
import { executarComIa } from '@/server/ia/conduzir'
import { escolherModelo } from '@/server/ia/modelo'

/**
 * Roda o motor sem WhatsApp nenhum.
 *
 * O endpoint é **sem estado**: quem guarda a sessão é o navegador, que devolve
 * ela a cada mensagem. Isso não é atalho de MVP — é o que a pureza do motor
 * permite. O webhook do WhatsApp chama exatamente o mesmo caminho, mudando só
 * de onde vem a sessão (banco, em vez do corpo da requisição).
 *
 * A IA roda aqui de verdade, com a chave da 4YU. É o que permite desenhar um
 * fluxo na frente do cliente e mostrar o bot respondendo na mesma reunião. O
 * dado que passa por aqui é inventado por quem está testando — ver
 * `ia/modelo.ts` sobre onde fica a linha entre demonstração e conversa real.
 */

const corpoSchema = z.object({
  fluxo: fluxoSchema,
  sessao: sessaoSchema,
  entrada: entradaSchema,
  /** O que o cliente escreveu sobre o negócio. É o que fecha o escopo da IA. */
  contextoNegocio: z.string().default(''),
  /** Espelha o plano da automação: sem contratar, o simulador não chama modelo. */
  iaHabilitada: z.boolean().default(false),
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico: z
    .array(z.object({ de: z.enum(['pessoa', 'bot']), texto: z.string() }))
    .default([]),
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

  const { fluxo, sessao, entrada, contextoNegocio, iaHabilitada, historico } = analise.data
  const { modelo } = escolherModelo({ iaHabilitada })

  return Response.json(
    await executarComIa(fluxo, sessao, entrada, { modelo, contextoNegocio, historico }),
  )
}
