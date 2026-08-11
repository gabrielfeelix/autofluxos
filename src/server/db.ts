import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente do Supabase com a chave **secreta**.
 *
 * Ela ignora RLS — é a única coisa que consegue ler e escrever, porque as
 * tabelas estão com RLS ligada e sem política nenhuma (ver 0001_init.sql).
 *
 * O `import 'server-only'` no topo não é enfeite: se algum dia alguém importar
 * este arquivo de um componente de cliente, o build quebra na hora, em vez de
 * mandar a chave secreta para dentro do bundle do navegador.
 */

let cache: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (cache) return cache

  const url = process.env.SUPABASE_URL
  const chave = process.env.SUPABASE_SECRET_KEY

  if (!url || !chave) {
    throw new Error(
      'Faltam SUPABASE_URL e SUPABASE_SECRET_KEY. Copie o .env.example para .env ' +
        '(os valores estão em 4yu-apps/.secrets/4yu.env, prefixo AUTOFLUXOS_).',
    )
  }

  cache = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cache
}
