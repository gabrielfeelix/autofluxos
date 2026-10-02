import { z } from 'zod'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo } from '@/server/api/autenticar'
import { abrirOportunidadePelaApi, listarOportunidadesDaApi } from '@/server/api/funil'

/**
 * `GET /api/v1/funil/oportunidades?telefone=...`: as oportunidades de um
 * contato, abertas por padrão.
 *
 * `POST /api/v1/funil/oportunidades`: garante uma oportunidade aberta do
 * contato num funil (o padrão, se não vier `funil_id`), na etapa pedida (a
 * primeira, se não vier `etapa_id`). 201 quando abriu, 200 quando já existia.
 */

const filtroSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40),
  funil_id: z.guid().optional(),
  situacao: z.enum(['aberta', 'ganha', 'perdida', 'todas']).default('aberta'),
})

export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'funil:ler')
  if (acesso instanceof Response) return acesso

  const analise = filtroSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  try {
    const oportunidades = await listarOportunidadesDaApi(acesso.clienteId, {
      telefone: analise.data.telefone,
      situacao: analise.data.situacao,
      ...(analise.data.funil_id ? { funilId: analise.data.funil_id } : {}),
    })
    if (!oportunidades) return erroDaApi(404, 'contato_nao_encontrado', 'Nenhum contato com este telefone nesta conta.')
    return Response.json({ oportunidades })
  } catch (erro) {
    console.error(`[api] GET oportunidades falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para ler as oportunidades agora. Tente de novo.')
  }
}

const corpoSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40),
  funil_id: z.guid().optional(),
  etapa_id: z.guid().optional(),
})

export async function POST(request: Request) {
  const acesso = await autenticarChave(request, 'funil:escrever')
  if (acesso instanceof Response) return acesso

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  try {
    const resultado = await abrirOportunidadePelaApi(acesso.clienteId, {
      telefone: analise.data.telefone,
      ...(analise.data.funil_id ? { funilId: analise.data.funil_id } : {}),
      ...(analise.data.etapa_id ? { etapaId: analise.data.etapa_id } : {}),
    })
    if (!resultado.ok) return erroDaApi(resultado.status, resultado.codigo, resultado.mensagem)
    return Response.json({ oportunidade: resultado.oportunidade }, { status: resultado.criada ? 201 : 200 })
  } catch (erro) {
    console.error(`[api] POST oportunidades falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para abrir a oportunidade agora. Tente de novo.')
  }
}
