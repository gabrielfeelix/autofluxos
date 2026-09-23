import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { removerComDestino } from './usuarios'

/**
 * Tirar alguém da conta com o destino das pendências (E15, RB-40).
 *
 * O que só o banco prova: reatribuir e remover acontecem juntos, só o que está
 * aberto muda de mão, e o destino precisa ser desta conta.
 */
const temBanco = Boolean(process.env.DATABASE_URL)
const marca = `zz-e15-${Math.random().toString(36).slice(2, 8)}`
const pool = temBanco ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }) : null
const q = async (sql: string, valores: unknown[] = []) => (await pool!.query(sql, valores)).rows

let conta = ''
let outraConta = ''
let sai = ''
let fica = ''
let estranho = ''
let contato = ''

async function pessoa(nome: string) {
  const [linha] = await q(
    `insert into af_usuarios (name, email, "emailVerified") values ($1, $2, false) returning id`,
    [nome, `${marca}-${nome}@exemplo.test`],
  )
  return String(linha.id)
}

beforeAll(async () => {
  if (!temBanco) return
  conta = String((await q(`insert into clients (nome, slug) values ($1, $1) returning id`, [`${marca}-conta`]))[0].id)
  outraConta = String((await q(`insert into clients (nome, slug) values ($1, $1) returning id`, [`${marca}-outra`]))[0].id)
  sai = await pessoa('sai')
  fica = await pessoa('fica')
  estranho = await pessoa('estranho')
  await q(
    `insert into af_membros ("organizationId", "userId", role) values ($1, $2, 'member'), ($1, $3, 'owner'), ($4, $5, 'owner')`,
    [conta, sai, fica, outraConta, estranho],
  )
  contato = String(
    (
      await q(
        `insert into contacts (client_id, wa_id, nome, atribuido_a) values ($1, $2, 'Contato', $3) returning id`,
        [conta, `55449${Math.floor(Math.random() * 1e8)}`, sai],
      )
    )[0].id,
  )
  const [{ id: quadro }] = await q(`insert into quadros (client_id, nome) values ($1, 'Funil') returning id`, [conta])
  const [{ id: coluna }] = await q(`insert into quadro_colunas (quadro_id, nome) values ($1, 'Novo') returning id`, [quadro])
  await q(
    `insert into quadro_cartoes (quadro_id, coluna_id, contact_id, client_id, responsavel, situacao)
     values ($1, $2, $3, $4, $5, 'aberta'), ($1, $2, $3, $4, $5, 'ganha')`,
    [quadro, coluna, contato, conta, sai],
  )
  await q(
    `insert into atividades (client_id, contact_id, titulo, responsavel, situacao, concluida_em)
     values ($1, $2, 'aberta', $3, 'aberta', null), ($1, $2, 'feita', $3, 'concluida', now())`,
    [conta, contato, sai],
  )
})

afterAll(async () => {
  if (!temBanco) return
  await q('delete from clients where id = any($1)', [[conta, outraConta].filter(Boolean)])
  await q('delete from af_usuarios where email like $1', [`${marca}-%`])
  await pool!.end()
})

describe.skipIf(!temBanco)('remover com destino', () => {
  it('recusa destino de outra conta, e não mexe em nada', async () => {
    const r = await removerComDestino(conta, sai, estranho)
    expect(r.ok).toBe(false)
    const membros = await q(`select 1 from af_membros where "organizationId" = $1 and "userId" = $2`, [conta, sai])
    expect(membros).toHaveLength(1)
    const [c] = await q(`select atribuido_a from contacts where id = $1`, [contato])
    expect(String(c.atribuido_a)).toBe(sai)
  })

  it('remover com destino reatribui conversas, cartões e atividades abertas', async () => {
    const r = await removerComDestino(conta, sai, fica)
    expect(r).toEqual({ ok: true, conversas: 1, cartoes: 1, atividades: 1 })

    const [c] = await q(`select atribuido_a from contacts where id = $1`, [contato])
    expect(String(c.atribuido_a)).toBe(fica)
    const cartoes = await q(`select situacao, responsavel from quadro_cartoes where client_id = $1 order by situacao`, [conta])
    expect(cartoes.map((l) => [l.situacao, String(l.responsavel)])).toEqual([
      ['aberta', fica],
      ['ganha', sai],
    ])
    const atividades = await q(`select situacao, responsavel from atividades where client_id = $1 order by situacao`, [conta])
    expect(atividades.map((l) => [l.situacao, String(l.responsavel)])).toEqual([
      ['aberta', fica],
      ['concluida', sai],
    ])
    const membros = await q(`select 1 from af_membros where "organizationId" = $1 and "userId" = $2`, [conta, sai])
    expect(membros).toHaveLength(0)
  })

  it('o último proprietário não sai', async () => {
    const r = await removerComDestino(conta, fica, null)
    expect(r.ok).toBe(false)
  })
})
