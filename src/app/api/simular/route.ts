import { z } from 'zod'
import { entradaSchema, sessaoSchema } from '@/core/engine/types'
import { fluxoSchema } from '@/core/flow/schema'
import { executarComEfeitos } from '@/server/efeitos/resolver'
import { escolherModelo } from '@/server/ia/modelo'
import { chaveDeLimite, consumirLimite } from '@/server/limite'
import { acharFluxo } from '@/server/repos/fluxos'
import { conferirAcessoAoCliente } from '@/server/sessao'

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

/**
 * Esta rota roda o mesmo trabalho bloqueante que o webhook: um fluxo com bloco
 * de API chama a internet daqui também. Sem orçamento de tempo próprio, um
 * parceiro lento faz a requisição morrer sem resposta nenhuma, e a aba Testar
 * fica só girando.
 */
export const maxDuration = 60
const LIMITE_DO_CORPO_EM_BYTES = 256 * 1024
const LIMITE_DE_NOS = 200

const corpoSchema = z.object({
  fluxo: fluxoSchema,
  sessao: sessaoSchema,
  entrada: entradaSchema,
  /** O que o cliente escreveu sobre o negócio. É o que fecha o escopo da IA. */
  contextoNegocio: z.string().default(''),
  /** Espelha o plano da automação: sem contratar, o simulador não chama modelo. */
  iaHabilitada: z.boolean().default(false),
  /**
   * Qual automação está sendo testada.
   *
   * Repare que **não** é o `clienteId`: quem diz de quem é o fluxo é o banco,
   * não o corpo da requisição. Aceitar o cliente daqui deixaria qualquer um
   * postar um fluxo inventado, apontar para o cliente que quisesse e mandar a
   * credencial dele para um endereço próprio. O desenho pode vir de fora
   * (é o ponto do simulador: testar o que ainda não foi salvo); a identidade,
   * não.
   */
  fluxoId: z.string().optional(),
  /** A conversa até aqui, para a IA não repetir o que já foi dito. */
  historico: z
    .array(z.object({ de: z.enum(['pessoa', 'bot']), texto: z.string() }))
    .default([]),
})

export async function POST(req: Request) {
  const tamanhoDeclarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 256 KB' }, { status: 413 })
  }

  let texto: string
  try {
    texto = await req.text()
  } catch {
    return Response.json({ erro: 'não foi possível ler o corpo' }, { status: 400 })
  }
  if (new TextEncoder().encode(texto).byteLength > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 256 KB' }, { status: 413 })
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
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

  const { fluxo, sessao, entrada, contextoNegocio, iaHabilitada, historico, fluxoId } =
    analise.data

  if (fluxo.nodes.length > LIMITE_DE_NOS) {
    return Response.json({ erro: 'fluxo excede 200 nós' }, { status: 413 })
  }

  if (!(await consumirLimite(chaveDeLimite('simular', req.headers)))) {
    return Response.json({ erro: 'muitas tentativas, espere' }, { status: 429 })
  }

  // O dono sai do banco, pelo id da automação. Sem `fluxoId`, ou com um que
  // não existe, o teste roda sem credencial nenhuma — que é o certo: melhor o
  // bloco de API falhar do que usar a chave de alguém por engano.
  const clienteId = fluxoId ? ((await acharFluxo(fluxoId))?.clienteId ?? undefined) : undefined

  /**
   * **O furo que estava aberto.**
   *
   * O desenho pode vir de fora — é o ponto do simulador: testar o que ainda não
   * foi salvo. O `fluxoId`, não: ele é o que faz o motor resolver a credencial
   * de um cliente e mandá-la para a URL que o corpo pedir. Sem esta linha,
   * bastava postar um fluxo inventado apontando para o `fluxoId` de qualquer
   * cliente. Era inofensivo quando uma senha só dava acesso a tudo; virava
   * escalada de privilégio no minuto em que o primeiro cliente entrasse.
   *
   * Sem `fluxoId` não há credencial a resolver, e o teste roda como sempre
   * rodou — que é o certo: melhor o bloco de API falhar do que usar a chave de
   * alguém por engano.
   */
  if (clienteId && !(await conferirAcessoAoCliente(clienteId))) {
    return Response.json({ erro: 'não achei essa automação' }, { status: 404 })
  }

  const { modelo } = escolherModelo({ iaHabilitada })

  return Response.json(
    await executarComEfeitos(fluxo, sessao, entrada, {
      modelo,
      contextoNegocio,
      historico,
      // A aba Testar chama API de verdade. Dizer que veio daqui é o que permite
      // o sistema do cliente separar tráfego de teste do movimento real dele.
      origem: 'simulador',
      clienteId,
    }),
  )
}
