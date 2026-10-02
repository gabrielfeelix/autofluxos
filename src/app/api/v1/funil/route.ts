import { autenticarChave, erroDaApi } from '@/server/api/autenticar'
import { listarFunisDaApi } from '@/server/api/funil'

/** `GET /api/v1/funil`: os funis da organização e as etapas de cada um, em ordem. */
export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'funil:ler')
  if (acesso instanceof Response) return acesso

  try {
    return Response.json({ funis: await listarFunisDaApi(acesso.clienteId) })
  } catch (erro) {
    console.error(`[api] GET funil falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para ler o funil agora. Tente de novo.')
  }
}
