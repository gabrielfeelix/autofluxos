import { readFileSync } from 'node:fs'

/**
 * Acesso direto ao banco **local** para montar o cenário de um e2e.
 *
 * Recusa qualquer `SUPABASE_URL` que não seja local: e2e nunca escreve em
 * produção, nem por engano de `.env`.
 */
function envLocal(): Record<string, string> {
  const env = Object.fromEntries(
    readFileSync(new URL('../../.env.teste-local', import.meta.url), 'utf8')
      .split('\n')
      .filter((linha) => linha.includes('=') && !linha.startsWith('#'))
      .map((linha) => [linha.slice(0, linha.indexOf('=')), linha.slice(linha.indexOf('=') + 1).trim()]),
  )
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.SUPABASE_URL ?? '')) throw new Error('SUPABASE_URL não é local')
  return env
}

/** PostgREST do banco local, com a chave de serviço local. */
export async function rest(caminho: string, init: { method?: string; body?: unknown } = {}) {
  const env = envLocal()
  const resposta = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: env.SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return (await resposta.json()) as { id: string }[]
}
