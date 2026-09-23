import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'

/**
 * Editar perfil (7.5): a ação só mexe na própria sessão.
 *
 * A sessão é simulada; o banco é o local. O id de outra pessoa mandado no
 * formulário tem de ser ignorado, porque a ação nem lê id da tela.
 */
const temBanco = Boolean(process.env.DATABASE_URL)
const marca = `zz-perfil-${Math.random().toString(36).slice(2, 8)}`
const pool = temBanco ? new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }) : null
let eu = ''
let outra = ''

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('./sessao', () => ({
  sessaoAtual: async () => ({
    usuario: { id: eu, nome: 'Eu', email: 'eu@x', imagem: null, papelDePlataforma: null, banido: false },
    contaAtivaId: null,
    impersonadoPor: null,
  }),
}))
const { acaoEditarPerfil } = await import('./acoes-perfil')

async function criar(nome: string) {
  const { rows } = await pool!.query(
    `insert into af_usuarios (name, email, "emailVerified") values ($1, $2, false) returning id`,
    [nome, `${marca}-${nome}@exemplo.test`],
  )
  return String(rows[0].id)
}
const nomeDe = async (id: string) =>
  String((await pool!.query('select name from af_usuarios where id = $1', [id])).rows[0].name)

beforeAll(async () => {
  if (!temBanco) return
  eu = await criar('eu')
  outra = await criar('outra')
})

afterAll(async () => {
  if (!temBanco) return
  await pool!.query('delete from af_usuarios where email like $1', [`${marca}-%`])
  await pool!.end()
})

describe.skipIf(!temBanco)('editar perfil', () => {
  it('editar perfil só altera o próprio usuário', async () => {
    const dados = new FormData()
    dados.set('nome', 'Nome Novo')
    dados.set('id', outra)
    dados.set('usuarioId', outra)
    const r = await acaoEditarPerfil(dados)
    expect(r.ok).toBe(true)
    expect(await nomeDe(eu)).toBe('Nome Novo')
    expect(await nomeDe(outra)).toBe('outra')
  })

  it('nome vazio é recusado', async () => {
    const dados = new FormData()
    dados.set('nome', '   ')
    const r = await acaoEditarPerfil(dados)
    expect(r.ok).toBe(false)
    expect(await nomeDe(eu)).toBe('Nome Novo')
  })
})
