import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente do Supabase com a chave **secreta**.
 *
 * Ela ignora RLS, é a única coisa que consegue ler e escrever, porque as
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
 * como exceção e a pessoa recebe 500 e "Alguma coisa quebrou aqui", quando a
 * resposta certa é a mesma de um id que simplesmente não existe: não achei.
 *
 * E isso não é caso raro: os endereços do painel carregam uuid de cliente, de
 * fluxo e de contato, então link truncado no WhatsApp, id colado pela metade e
 * id de outro ambiente caem todos aqui.
 *
 * Vale só para leitura por id. Em escrita, id torto continua sendo erro de
 * verdade, quem manda apagar algo com id inválido merece saber que não apagou.
 */
export function ehIdInvalido(error: { code?: string } | null | undefined): boolean {
  return error?.code === '22P02'
}

/**
 * Isto **parece** um uuid?
 *
 * Existe para um caso só: o filtro `or(...)` do PostgREST é uma string, e
 * montar string de consulta com id vindo de fora é a mesma classe de problema
 * que injeção de SQL, uma vírgula no lugar errado vira outro filtro. Onde o
 * id entra como parâmetro (`eq`, `in`) o driver escapa e isto não faz falta.
 *
 * Não substitui `ehIdInvalido`: aquele trata o id torto que **chegou** ao
 * banco; este impede que ele chegue como sintaxe.
 */
export function pareceUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}

/** Hosts que contam como banco local. Espelha `test/ambiente-local.ts`. */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal'])

/**
 * Este endereço é de um banco local?
 *
 * Por host exato, e não por `includes('localhost')`, que erra para os dois
 * lados: `https://localhost.evil.com` passaria e um endereço legítimo com porta
 * não bate com a string crua.
 */
function ehEnderecoLocal(url: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Sob teste, endereço remoto é recusado aqui, na abertura da conexão.
 *
 * A guarda de `test/ambiente-local.ts` vive no `setupFiles` do config de
 * integração, então ela protege **um** caminho de execução. Quem rodasse
 * `npx vitest` pegava o config padrão, que carregava o `.env` de produção, e a
 * suíte de banco escrevia lá — foi o que pôs três `publicou_fluxo` de teste no
 * `af_auditoria` de uma conta de cliente em 21/set/2026.
 *
 * Aqui a recusa não depende de qual config foi escolhido: o que decide é o
 * endereço. AutoFluxos e Verandi dividem o projeto de produção, e um teste que
 * cria e apaga registro lá mexe no banco de dois produtos ao mesmo tempo.
 */
export function conferirDestinoDeTeste(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!env.VITEST) return

  const url = env.SUPABASE_URL
  if (!url || ehEnderecoLocal(url)) return

  let host = 'endereço inválido'
  try {
    host = new URL(url).hostname
  } catch {
    // Fica com o texto padrão. A URL inteira nunca é impressa.
  }

  throw new Error(
    `[db] SUPABASE_URL aponta para um host remoto (${host}) durante os testes. ` +
      'Testes só falam com banco local: rode `npm run test:integration:local` ' +
      'com o .env.teste-local, e nunca com o .env de produção.',
  )
}

let cache: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (cache) return cache

  conferirDestinoDeTeste()

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
