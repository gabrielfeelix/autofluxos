import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { auth } from './auth'

/**
 * O login contra o banco de verdade.
 *
 * Não testa o Better Auth — testa **a nossa configuração dele**: que os nomes de
 * tabela que escolhemos são os que ele usa, que a senha sai como hash, e que a
 * impersonação grava quem entrou na conta de quem. Errar qualquer um desses
 * três só apareceria no primeiro login de um cliente de verdade.
 */
const temBanco = Boolean(process.env.DATABASE_URL)
const marca = `zz-auth-${Math.random().toString(36).slice(2, 8)}`
const email = (sufixo: string) => `${marca}-${sufixo}@exemplo.test`
const SENHA = 'senha-comprida-de-teste'

const criados: string[] = []

afterAll(async () => {
  if (!temBanco || criados.length === 0) return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  // Cascata em `af_contas` e `af_sessoes` leva sessão e credencial junto.
  await pool.query('delete from public.af_usuarios where email = any($1)', [criados])
  await pool.end()
})

async function criar(sufixo: string) {
  const endereco = email(sufixo)
  criados.push(endereco)
  const r = await auth.api.signUpEmail({
    body: { email: endereco, password: SENHA, name: `Teste ${sufixo}` },
  })
  return { endereco, usuario: r.user }
}

describe.skipIf(!temBanco)('login por usuário', () => {
  it('cria usuário nas tabelas que nomeamos, e não em `user`', async () => {
    const { usuario } = await criar('nomes')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query('select "email" from public.af_usuarios where id = $1', [
        usuario.id,
      ])
      expect(rows).toHaveLength(1)
    } finally {
      await pool.end()
    }
  })

  it('guarda hash, nunca a senha', async () => {
    const { usuario } = await criar('hash')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select "password" from public.af_contas where "userId" = $1',
        [usuario.id],
      )
      const guardado = rows[0]?.password as string
      expect(guardado).toBeTruthy()
      expect(guardado).not.toContain(SENHA)
      expect(guardado.length).toBeGreaterThan(40)
    } finally {
      await pool.end()
    }
  })

  it('entra com a senha certa e recusa a errada', async () => {
    const { endereco } = await criar('entrar')

    const ok = await auth.api.signInEmail({ body: { email: endereco, password: SENHA } })
    expect(ok.user.email).toBe(endereco)

    await expect(
      auth.api.signInEmail({ body: { email: endereco, password: 'outra-coisa-qualquer' } }),
    ).rejects.toThrow()
  })

  it('recusa senha curta — o mínimo é 10', async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: email('curta'), password: 'abc123', name: 'Curta' },
      }),
    ).rejects.toThrow()
  })

  it('não deixa dois usuários com o mesmo e-mail', async () => {
    const { endereco } = await criar('duplicado')

    await expect(
      auth.api.signUpEmail({ body: { email: endereco, password: SENHA, name: 'Outro' } }),
    ).rejects.toThrow()
  })

  it('a sessão nasce sem `impersonatedBy` — quem entra pela senha é ele mesmo', async () => {
    const { endereco } = await criar('sessao')
    const entrada = await auth.api.signInEmail({ body: { email: endereco, password: SENHA } })

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      const { rows } = await pool.query(
        'select "impersonatedBy", "expiresAt" from public.af_sessoes where "userId" = $1',
        [entrada.user.id],
      )
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.impersonatedBy).toBeNull()
      // Sete dias, como configurado. Um prazo que desandasse aqui só apareceria
      // como "o painel me desloga sozinho" semanas depois.
      const resta = new Date(rows[0]?.expiresAt as string).getTime() - Date.now()
      expect(resta).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    } finally {
      await pool.end()
    }
  })
})
