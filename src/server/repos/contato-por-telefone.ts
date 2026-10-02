import 'server-only'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import { db, ehIdInvalido } from '../db'

/**
 * O contato pelo telefone, aceitando as grafias que significam o mesmo aparelho.
 *
 * `chavesDoTelefone` resolve o nono dígito: o sistema do outro lado pode ter
 * cadastrado `11 8765-4321` e o WhatsApp guardou `5511987654321`. Casar só pela
 * forma exata faria o aviso não sair para metade da base por um dígito que o
 * Brasil acrescentou em 2012.
 *
 * Um lugar só para o webhook de entrada, o lead do formulário e a API pública:
 * eram duas cópias privadas, e uma delas casava só pela forma exata.
 */
export async function acharContatoPeloTelefone(
  clienteId: string,
  telefone: string,
): Promise<string | null> {
  const chaves = chavesDoTelefone(telefone)
  // Lista vazia = número que não dá para casar com segurança (sem DDD, por
  // exemplo). Chutar aqui casaria o evento de uma pessoa com o cadastro de
  // outra, que é pior que não avisar.
  if (chaves.length === 0) return null

  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('wa_id', chaves)
    .limit(1)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para achar o contato: ${error.message}`)
  return data ? (data as { id: string }).id : null
}
