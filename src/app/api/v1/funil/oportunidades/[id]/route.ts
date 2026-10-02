import { z } from 'zod'
import { autenticarChave, erroDaApi, lerCorpo } from '@/server/api/autenticar'
import { mudarOportunidadePelaApi, type MudancaDaOportunidade } from '@/server/api/funil'

/**
 * `PATCH /api/v1/funil/oportunidades/{id}`: uma mudança por chamada.
 *
 * - `{ "etapa_id": "..." }` muda de etapa, no mesmo funil;
 * - `{ "situacao": "ganha", "valor": 450 }` marca como ganha (valor opcional);
 * - `{ "situacao": "perdida", "motivo": "Preço" }` marca como perdida, com um
 *   dos motivos de perda da conta.
 *
 * Ganhar e perder seguem a regra da tela: o estágio do contato muda e, se o
 * funil estiver encadeado, a oportunidade seguinte abre sozinha.
 */

const corpoSchema = z.union([
  z.object({ etapa_id: z.guid() }).strict(),
  z.object({ situacao: z.literal('ganha'), valor: z.number().min(0).max(1e9).nullable().optional() }).strict(),
  z.object({ situacao: z.literal('perdida'), motivo: z.string().trim().min(1, 'obrigatório').max(120) }).strict(),
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const acesso = await autenticarChave(request, 'funil:escrever')
  if (acesso instanceof Response) return acesso

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) {
    return erroDaApi(422, 'corpo_invalido', 'Envie só etapa_id, ou situacao "ganha" (com valor opcional), ou situacao "perdida" com motivo.')
  }

  const { id } = await params
  if (!z.guid().safeParse(id).success) {
    return erroDaApi(404, 'oportunidade_nao_encontrada', 'Nenhuma oportunidade com este id nesta conta.')
  }

  const dados = analise.data
  const mudanca: MudancaDaOportunidade =
    'etapa_id' in dados
      ? { etapaId: dados.etapa_id }
      : dados.situacao === 'ganha'
        ? { situacao: 'ganha', valor: dados.valor ?? null }
        : { situacao: 'perdida', motivo: dados.motivo }

  try {
    const resultado = await mudarOportunidadePelaApi(acesso.clienteId, id, mudanca)
    if (!resultado.ok) return erroDaApi(resultado.status, resultado.codigo, resultado.mensagem)
    return Response.json({ oportunidade: resultado.oportunidade })
  } catch (erro) {
    console.error(`[api] PATCH oportunidade falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para mudar a oportunidade agora. Tente de novo.')
  }
}
