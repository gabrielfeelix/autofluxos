'use server'

import { contatosPorMensagem } from './repos/leads'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * Os contatos da conta em cuja conversa o termo aparece, para a busca do
 * Inbox. Só ids: a tela cruza com a fila que a pessoa já pode ver.
 *
 * A porta é a do Inbox (`atender`). Recusa devolve lista vazia, que é o que a
 * busca já mostra quando não acha nada.
 */
export async function acaoBuscarNasMensagens(clienteId: string, termo: string): Promise<string[]> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return []
  return contatosPorMensagem(clienteId, termo)
}
