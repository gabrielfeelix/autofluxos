import { autenticarChave, erroDaApi } from '@/server/api/autenticar'
import { listarTemplatesDaApi } from '@/server/api/templates'

/**
 * `GET /api/v1/templates`: os modelos aprovados pela Meta, com quantas
 * variáveis cada um pede no corpo e no cabeçalho. É o que quem integra precisa
 * saber antes de montar o `POST /mensagens/template`.
 */
export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'mensagens:enviar')
  if (acesso instanceof Response) return acesso

  try {
    return Response.json({ templates: await listarTemplatesDaApi(acesso.clienteId) })
  } catch (erro) {
    console.error(`[api] GET templates falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para listar os modelos agora. Tente de novo.')
  }
}
