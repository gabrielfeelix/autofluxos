import 'server-only'
import { fotoDoPerfil } from './instagram/conexao'
import { fotoNoMessenger } from './messenger/conexao'
import { lerTokenDoCanal, listarCanais } from './repos/conversas'

/**
 * Os canais da conta que entregam foto de perfil, cada um com o jeito dele de
 * buscar. Separado de `foto-do-contato.ts` para o recebimento da mensagem não
 * carregar a lista de canais que não usa.
 */
export async function canaisComFoto(
  clienteId: string,
): Promise<{ canal: 'instagram' | 'messenger'; buscarLink: (id: string) => Promise<string | null> }[]> {
  const ativos = (await listarCanais(clienteId)).filter(
    (c) => c.status === 'ativo' && (c.provider === 'instagram' || c.provider === 'messenger') && c.tokenRef,
  )
  const lista: { canal: 'instagram' | 'messenger'; buscarLink: (id: string) => Promise<string | null> }[] = []
  for (const c of ativos) {
    const token = await lerTokenDoCanal(c).catch(() => null)
    if (!token) continue
    lista.push(
      c.provider === 'instagram'
        ? { canal: 'instagram', buscarLink: (id) => fotoDoPerfil({ igsid: id, token }) }
        : { canal: 'messenger', buscarLink: (id) => fotoNoMessenger(id, token) },
    )
  }
  return lista
}
