import { z } from 'zod'
import { gravarContatoDaApi } from '@/server/api/contatos'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo } from '@/server/api/autenticar'

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
