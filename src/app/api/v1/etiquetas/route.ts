import { autenticarChave, erroDaApi } from '@/server/api/autenticar'
import { listarEtiquetasDaApi } from '@/server/api/contatos'

/**
 * `GET /api/v1/etiquetas`: as etiquetas da organização. Serve para saber os
 * nomes exatos antes de aplicar em `POST /contatos` ou filtrar em
 * `GET /contatos`.
 */
export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'contatos:ler')
  if (acesso instanceof Response) return acesso

  try {
    return Response.json({ etiquetas: await listarEtiquetasDaApi(acesso.clienteId) })
  } catch (erro) {
    console.error(`[api] GET etiquetas falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para listar as etiquetas agora. Tente de novo.')
  }
}
