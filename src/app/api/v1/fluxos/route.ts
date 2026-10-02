import { autenticarChave, erroDaApi } from '@/server/api/autenticar'
import { listarFluxos } from '@/server/repos/fluxos'

/**
 * `GET /api/v1/fluxos`: as automações que dá para disparar, publicadas e
 * ligadas. Existe para quem integra descobrir o `id` sem abrir o painel.
 */
export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'fluxos:disparar')
  if (acesso instanceof Response) return acesso

  try {
    const fluxos = (await listarFluxos(acesso.clienteId))
      .filter((fluxo) => fluxo.ativo && fluxo.versaoPublicadaId)
      .map((fluxo) => ({ id: fluxo.id, nome: fluxo.nome, canal: fluxo.canal }))
    return Response.json({ fluxos })
  } catch (erro) {
    console.error(`[api] GET fluxos falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para listar as automações agora. Tente de novo.')
  }
}
