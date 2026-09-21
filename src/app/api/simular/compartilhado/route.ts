import { z } from 'zod'
import { entradaSchema, sessaoSchema } from '@/core/engine/types'
import { varsDeData } from '@/core/datas'
import { SEMPRE_ABERTO, hojeNaConta } from '@/core/horario'
import { executarComEfeitos } from '@/server/efeitos/resolver'
import { escolherModelo } from '@/server/ia/modelo'
import { consumirLimite, JANELA_DA_VITRINE_SEGUNDOS, TETO_DA_VITRINE } from '@/server/limite'
import { acharPorToken } from '@/server/repos/compartilhar'

/**
 * A conversa da vitrine: o mesmo motor, rodando para quem não tem conta.
 *
 * É irmã de `/api/simular` e difere nos três pontos que a falta de sessão
 * obriga, e em nenhum outro:
 *
 * 1. **O desenho vem do banco, pelo token.** Na aba Testar o fluxo viaja no
 *    corpo, que é o ponto dela: testar o que ainda não foi salvo. Aqui aceitar
 *    fluxo do corpo daria a qualquer um um motor de uso geral, sem conta, com
 *    a nossa chave de IA e o nosso IP. O corpo traz só a sessão e a entrada.
 * 2. **A rede fica fechada** (`semRede`). O bloco de API não sai, responde dado
 *    de exemplo. Ver `OpcoesDeEfeitos.semRede`.
 * 3. **Não há cliente.** Sem `clienteId` não há credencial a resolver, não há
 *    salto para outra automação e as consultas da IA não têm como ler nada da
 *    conta de origem. Tudo isso já é o comportamento do resolvedor quando o
 *    cliente é `undefined`, e é por isso que ele não aparece aqui.
 *
 * O que **não** muda é o executor: é o mesmo `efeitos/resolver.ts` do WhatsApp.
 * Fluxo com erro de desenho erra aqui igual, que é o motivo de a vitrine
 * existir em vez de um roteiro bonito.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMITE_DO_CORPO_EM_BYTES = 64 * 1024

const corpoSchema = z.object({
  token: z.string().min(1).max(200),
  sessao: sessaoSchema,
  entrada: entradaSchema,
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico: z.array(z.object({ de: z.enum(['pessoa', 'bot']), texto: z.string() })).default([]),
})

export async function POST(req: Request) {
  const tamanhoDeclarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }

  let texto: string
  try {
    texto = await req.text()
  } catch {
    return Response.json({ erro: 'não foi possível ler o corpo' }, { status: 400 })
  }
  if (new TextEncoder().encode(texto).byteLength > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return Response.json({ erro: 'corpo não é JSON válido' }, { status: 400 })
  }

  const analise = corpoSchema.safeParse(bruto)
  if (!analise.success) {
    return Response.json({ erro: 'requisição inválida' }, { status: 400 })
  }

  const { token, sessao, entrada, historico } = analise.data

  const link = await acharPorToken(token)
  // A mesma frase para link inexistente, revogado e vencido: quem chegou aqui
  // sem link válido não precisa saber qual dos três é, e responder diferente
  // transformaria a rota num verificador de tokens.
  if (!link || link.estado !== 'valido' || !link.grafo) {
    return Response.json({ erro: 'este link não está mais disponível' }, { status: 404 })
  }

  /**
   * O teto é do link, não do endereço, e é consumido **depois** de o link ser
   * conferido: contar mensagem de link morto gastaria a cota de um link vivo.
   */
  if (!(await consumirLimite(`vitrine:${link.id}`, TETO_DA_VITRINE, JANELA_DA_VITRINE_SEGUNDOS))) {
    return Response.json(
      {
        erro: 'este link já rodou muitas mensagens de teste. Espere alguns minutos, ou peça um link novo a quem compartilhou.',
      },
      { status: 429 },
    )
  }

  const { modelo } = await escolherModelo({ iaHabilitada: link.iaHabilitada })

  return Response.json(
    await executarComEfeitos(link.grafo, sessao, entrada, {
      modelo,
      contextoNegocio: link.contextoNegocio,
      historico,
      hoje: hojeNaConta(SEMPRE_ABERTO.fuso),
      datas: varsDeData(SEMPRE_ABERTO.fuso),
      origem: 'simulador',
      semRede: true,
    }),
  )
}
