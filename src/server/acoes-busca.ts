'use server'

import { contatosPorMensagem } from './repos/leads'
import { exigirAcessoAoCliente } from './sessao'

/**
 * Os contatos da conta em cuja conversa o termo aparece, para a busca do
 * Inbox. Só ids: a tela cruza com a fila que a pessoa já pode ver.
 */
export async function acaoBuscarNasMensagens(clienteId: string, termo: string): Promise<string[]> {
  await exigirAcessoAoCliente(clienteId)
  return contatosPorMensagem(clienteId, termo)
}
