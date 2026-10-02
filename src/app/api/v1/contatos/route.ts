import { z } from 'zod'
import {
  gravarContatoDaApi,
  LIMITE_MAXIMO_DA_LISTA,
  LIMITE_PADRAO_DA_LISTA,
  listarContatosDaApi,
} from '@/server/api/contatos'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo } from '@/server/api/autenticar'

/**
 * `GET /api/v1/contatos`: os contatos da organização, do mais antigo para o
 * mais novo, em páginas por cursor. Filtros: `etiqueta` (nome), `criado_desde`
 * e `criado_ate` (ISO 8601). Para sincronizar, guarde o `proximo_cursor` e
 * continue dali na próxima vez.
 */

const filtroSchema = z.object({
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO_DA_LISTA).default(LIMITE_PADRAO_DA_LISTA),
  cursor: z.string().trim().min(1).max(300).optional(),
  etiqueta: z.string().trim().min(1).max(60).optional(),
  criado_desde: z.iso.datetime({ offset: true }).optional(),
  criado_ate: z.iso.datetime({ offset: true }).optional(),
})

export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'contatos:ler')
  if (acesso instanceof Response) return acesso

  const parametros = Object.fromEntries(new URL(request.url).searchParams)
  const analise = filtroSchema.safeParse(parametros)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  try {
    const resultado = await listarContatosDaApi(acesso.clienteId, {
      limite: analise.data.limite,
      ...(analise.data.cursor ? { cursor: analise.data.cursor } : {}),
      ...(analise.data.etiqueta ? { etiqueta: analise.data.etiqueta } : {}),
      ...(analise.data.criado_desde ? { criadoDesde: analise.data.criado_desde } : {}),
      ...(analise.data.criado_ate ? { criadoAte: analise.data.criado_ate } : {}),
    })
    if (!resultado.ok) {
      return resultado.motivo === 'cursor_invalido'
        ? erroDaApi(422, 'cursor_invalido', 'Cursor inválido. Use o proximo_cursor da resposta anterior, sem alterar.')
        : erroDaApi(404, 'etiqueta_nao_encontrada', `Nenhuma etiqueta "${analise.data.etiqueta}" nesta conta.`)
    }
    return Response.json({ contatos: resultado.contatos, proximo_cursor: resultado.proximo_cursor })
  } catch (erro) {
    console.error(`[api] GET contatos falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para listar os contatos agora. Tente de novo.')
  }
}

/**
 * `POST /api/v1/contatos`: cria ou atualiza um contato pelo telefone.
 *
 * 201 quando criou, 200 quando já existia. O que não foi aplicado (etiqueta
 * inexistente, campo protegido por correção humana) volta em `avisos`, e não
 * vira erro: o contato foi gravado, e recusar a chamada inteira por causa de
 * uma etiqueta faria o outro sistema repetir para sempre.
 */

const valorDeCampo = z.union([z.string(), z.number(), z.boolean()]).transform((valor) => String(valor).trim())

const corpoSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40),
  nome: z.string().trim().max(120).optional(),
  campos: z
    .record(z.string().trim().min(1).max(60).regex(/^[\p{L}\p{N}_ .-]+$/u, 'use letras, números, espaço, _ . ou -'), valorDeCampo)
    .refine((campos) => Object.keys(campos).length <= 50, 'no máximo 50 campos por chamada')
    .optional(),
  etiquetas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
})

export async function POST(request: Request) {
  const acesso = await autenticarChave(request, 'contatos:escrever')
  if (acesso instanceof Response) return acesso

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  try {
    const resultado = await gravarContatoDaApi(acesso.clienteId, analise.data)
    if (!resultado.ok) {
      return erroDaApi(422, 'telefone_invalido', 'Telefone sem DDD ou incompleto. Exemplo: 5511987654321.')
    }
    return Response.json(
      { contato: resultado.contato, avisos: resultado.avisos },
      { status: resultado.criado ? 201 : 200 },
    )
  } catch (erro) {
    console.error(`[api] POST contatos falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para gravar o contato agora. Tente de novo.')
  }
}
