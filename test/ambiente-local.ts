/**
 * O guarda que impede um teste de alcançar produção.
 *
 * AutoFluxos e Verandi dividem o mesmo projeto Supabase de produção. O
 * `vitest.config.ts` antigo carregava o `.env` inteiro para dentro de todo
 * teste, e os testes de integração se ligavam sozinhos assim que enxergavam
 * `SUPABASE_URL` e `SUPABASE_SECRET_KEY`. Quer dizer: `npm test` numa máquina
 * com `.env` criava e apagava registro no banco que atende cliente de verdade,
 * ao lado das tabelas da Verandi.
 *
 * A inversão que este arquivo faz: **credencial disponível deixa de ser
 * autorização**. Para falar com um banco, o teste precisa de um endereço que
 * seja comprovadamente local e de um consentimento escrito de propósito
 * (`AUTOFLUXOS_TESTE_LOCAL=sim`). Faltando qualquer um dos dois, o guarda
 * recusa antes de abrir conexão — e recusa com o motivo, não com um `skip`
 * silencioso, porque teste que se pula sozinho é teste que ninguém percebe que
 * parou de rodar.
 */

/** Hosts que aceitamos como banco local. Qualquer outro é remoto. */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal'])

export type Veredito =
  | { ok: true; url: string }
  | { ok: false; motivo: string }

/**
 * Este endereço é de um banco local?
 *
 * Feito com `URL` em vez de `includes('localhost')` porque comparação por
 * substring erra para os dois lados: `https://localhost.evil.com` passaria, e
 * um endereço legítimo com porta não bate com a string crua. O host precisa ser
 * exatamente um dos conhecidos.
 */
export function ehEnderecoLocal(url: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * O ambiente atual pode receber teste de integração?
 *
 * Devolve veredito em vez de lançar para o chamador escolher o que fazer: o
 * teste do próprio guarda quer ler o motivo, e o `db()` quer lançar.
 */
export function conferirAmbienteLocal(env: NodeJS.ProcessEnv = process.env): Veredito {
  if (env.AUTOFLUXOS_TESTE_LOCAL !== 'sim') {
    return {
      ok: false,
      motivo:
        'teste de integração exige AUTOFLUXOS_TESTE_LOCAL=sim. ' +
        'Sem esse consentimento explícito, nenhuma conexão é aberta.',
    }
  }

  const url = env.SUPABASE_URL
  if (!url) {
    return { ok: false, motivo: 'falta SUPABASE_URL apontando para o Supabase local.' }
  }

  if (!ehEnderecoLocal(url)) {
    return {
      ok: false,
      motivo:
        `SUPABASE_URL aponta para um host remoto (${hostDe(url)}). ` +
        'Testes só falam com banco local: AutoFluxos e Verandi dividem o projeto de produção.',
    }
  }

  if (!env.SUPABASE_SECRET_KEY) {
    return { ok: false, motivo: 'falta SUPABASE_SECRET_KEY do Supabase local.' }
  }

  return { ok: true, url }
}

/** O host, só para a mensagem de recusa. Nunca imprime a URL inteira. */
function hostDe(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'endereço inválido'
  }
}

/** Como `conferirAmbienteLocal`, mas lança. É o que o `db()` chama no teste. */
export function exigirAmbienteLocal(env: NodeJS.ProcessEnv = process.env): string {
  const veredito = conferirAmbienteLocal(env)
  if (!veredito.ok) throw new Error(`[ambiente-local] ${veredito.motivo}`)
  return veredito.url
}
