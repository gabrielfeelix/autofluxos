import 'server-only'
import { db } from './db'

/**
 * O cofre: guardar, ler e apagar segredo no Supabase Vault.
 *
 * Nasceu dentro de `repos/conexoes.ts`, onde era privado, e saiu de lá quando a
 * chave de IA do cliente passou a precisar do mesmo cofre. Duas cópias das
 * mesmas três chamadas é como uma delas deixa de apagar o segredo órfão sem
 * ninguém notar.
 *
 * As três RPC vivem no banco desde `0006_conexoes.sql`. O valor nunca volta
 * para a tela: quem lê é servidor, uma vez, na hora de usar.
 */

export async function guardarNoCofre(valor: string, apelido: string): Promise<string> {
  const { data, error } = await db().rpc('criar_segredo', { valor, apelido })
  if (error) throw new Error(`não deu para guardar no cofre: ${error.message}`)
  if (typeof data !== 'string') throw new Error('o cofre não devolveu uma referência')
  return data
}

/**
 * O valor, ou `null` quando a referência não aponta para nada.
 *
 * `null` e não erro: segredo apagado por fora do produto é estado possível, e
 * quem chama sabe o que fazer com a ausência melhor do que uma exceção sabe.
 */
export async function lerDoCofre(id: string): Promise<string | null> {
  const { data, error } = await db().rpc('ler_segredo', { alvo: id })
  if (error) throw new Error(`não deu para ler do cofre: ${error.message}`)
  return typeof data === 'string' && data !== '' ? data : null
}

export async function apagarDoCofre(id: string): Promise<void> {
  await db().rpc('apagar_segredo', { alvo: id })
}
