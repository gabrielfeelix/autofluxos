import { afterAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'

/**
 * Entrar com a própria conta, contra o banco de verdade.
 *
 * **O que este teste guarda:** que uma senha correta *entra*. Parece óbvio
 * demais para merecer teste, e foi exatamente por isso que ficou quebrado — a
 * ação autenticava, o cookie saía na resposta, e a tela respondia "credenciais
 * não conferem" mesmo assim.
 *
 * A causa era `headers()`. No Next ele devolve os cabeçalhos **da requisição
 * que chegou**, e não passa a enxergar o cookie que a própria ação acabou de
 * gravar: quem grava é `cookies()`, e os dois não são a mesma coisa. Reler a
 * sessão logo depois de criá-la, portanto, sempre encontrava ninguém.
 *
 * É por isso que o mock abaixo é *fixo* de propósito. Um mock em que escrever
 * cookie mudasse os cabeçalhos passaria com o código quebrado — ele estaria
 * testando um Next que não existe.
 */
const IP = `198.51.100.${Math.floor(Math.random() * 200) + 20}`
const CABECALHOS = new Headers({ 'x-forwarded-for': IP })

vi.mock('next/headers', () => {
  const guardados = new Map<string, string>()
  return {
    headers: async () => CABECALHOS,
    cookies: async () => ({
      get: (nome: string) =>
        guardados.has(nome) ? { name: nome, value: guardados.get(nome)! } : undefined,
      getAll: () => [...guardados].map(([name, value]) => ({ name, value })),
      // O `nextCookies()` do Better Auth chama de uma das duas formas.
      set: (a: string | { name: string; value: string }, b?: string) =>
        typeof a === 'string' ? guardados.set(a, b ?? '') : guardados.set(a.name, a.value),
      delete: (nome: string) => guardados.delete(nome),
    }),
  }
})

const { acaoEntrar } = await import('./acoes-conta')
const { autenticacao } = await import('./auth')

const temBanco = Boolean(process.env.DATABASE_URL)
const SENHA = 'senha-comprida-de-teste'
const criados: string[] = []

afterAll(async () => {
  if (!temBanco || criados.length === 0) return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  await pool.query('delete from public.af_usuarios where email = any($1)', [criados])
  await pool.end()
})

/** `redirect()` funciona lançando. Capturar é a única forma de afirmar sobre ele. */
async function destinoDe(acao: () => Promise<unknown>): Promise<string | null> {
  try {
    await acao()
    return null
  } catch (erro) {
    const digest = (erro as { digest?: string }).digest ?? ''
    // `NEXT_REDIRECT;push;/destino;...`
    return digest.startsWith('NEXT_REDIRECT') ? (digest.split(';')[2] ?? '') : null
  }
}

describe.skipIf(!temBanco)('entrar com a própria conta', () => {
  it('senha certa entra, e não volta dizendo que não confere', async () => {
    const email = `zz-entrar-${Math.random().toString(36).slice(2, 8)}@exemplo.test`
    criados.push(email)
    await autenticacao().api.signUpEmail({ body: { name: 'Teste Entrar', email, password: SENHA } })

    const formulario = new FormData()
    formulario.set('email', email)
    formulario.set('senha', SENHA)

    let devolvido: unknown = null
    const destino = await destinoDe(async () => {
      devolvido = await acaoEntrar({}, formulario)
    })

    // A mensagem de erro é a prova do defeito: ela só aparece quando a ação
    // decide que a credencial falhou.
    expect(devolvido).toBeNull()
    // Sem conta nenhuma, quem entra vai para o seletor de companhias.
    expect(destino).toBe('/contas')
  })

  it('senha errada continua não entrando', async () => {
    const email = `zz-entrar-${Math.random().toString(36).slice(2, 8)}@exemplo.test`
    criados.push(email)
    await autenticacao().api.signUpEmail({ body: { name: 'Teste Errado', email, password: SENHA } })

    const formulario = new FormData()
    formulario.set('email', email)
    formulario.set('senha', 'esta-nao-e-a-senha')

    const resultado = await acaoEntrar({}, formulario)
    expect(resultado.erro).toMatch(/não conferem/)
    expect(resultado.email).toBe(email)
  })
})
