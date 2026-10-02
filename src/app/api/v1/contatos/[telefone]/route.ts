import { lerContatoPeloTelefone } from '@/server/api/contatos'
import { autenticarChave, erroDaApi } from '@/server/api/autenticar'

/**
 * `GET /api/v1/contatos/{telefone}`: um contato, achado por qualquer grafia do
 * mesmo número (com ou sem DDI, com ou sem o nono dígito).
 */
export async function GET(request: Request, { params }: { params: Promise<{ telefone: string }> }) {
  const acesso = await autenticarChave(request, 'contatos:ler')
  if (acesso instanceof Response) return acesso

  const { telefone } = await params
  try {
    const contato = await lerContatoPeloTelefone(acesso.clienteId, decodeURIComponent(telefone))
    if (!contato) return erroDaApi(404, 'contato_nao_encontrado', 'Nenhum contato com este telefone nesta conta.')
    return Response.json({ contato })
  } catch (erro) {
    console.error(`[api] GET contato falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para ler o contato agora. Tente de novo.')
  }
}
