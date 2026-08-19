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

/**
 * O id do endereço não tem forma de uuid.
 *
 * O Postgres recusa `where id = 'nao-existe'` com **22P02** antes de olhar a
 * tabela, e o supabase-js entrega isso como erro comum. Sem tratar, ele sobe
 * como exceção e a pessoa recebe 500 e "Alguma coisa quebrou aqui" — quando a
 * resposta certa é a mesma de um id que simplesmente não existe: não achei.
 *
 * E isso não é caso raro: os endereços do painel carregam uuid de cliente, de
 * fluxo e de contato, então link truncado no WhatsApp, id colado pela metade e
 * id de outro ambiente caem todos aqui.
 *
 * Vale só para leitura por id. Em escrita, id torto continua sendo erro de
 * verdade — quem manda apagar algo com id inválido merece saber que não apagou.
 */
export function ehIdInvalido(error: { code?: string } | null | undefined): boolean {
  return error?.code === '22P02'
}

/**
 * Isto **parece** um uuid?
 *
 * Existe para um caso só: o filtro `or(...)` do PostgREST é uma string, e
 * montar string de consulta com id vindo de fora é a mesma classe de problema
 * que injeção de SQL — uma vírgula no lugar errado vira outro filtro. Onde o
 * id entra como parâmetro (`eq`, `in`) o driver escapa e isto não faz falta.
 *
 * Não substitui `ehIdInvalido`: aquele trata o id torto que **chegou** ao
 * banco; este impede que ele chegue como sintaxe.
 */
export function pareceUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}

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
