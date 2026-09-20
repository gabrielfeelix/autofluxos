import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool, type PoolClient } from 'pg'
import { RESPOSTAS_INICIAIS } from '@/core/onboarding'
import { MODELOS_DE_QUADRO } from '@/core/quadros-modelos'
import { acharModelo } from '@/exemplos/modelos'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
let conexao: PoolClient
beforeAll(async () => { conexao = await pool.connect() })
afterAll(async () => { conexao.release(); await pool.end() })
const respostas = { ...RESPOSTAS_INICIAIS, objetivo: 'vendas', atendimento: 'hibrido', funil: 'comercial', chatbot: 'recado', etapa: 3 }
const quadro = MODELOS_DE_QUADRO.find((item) => item.id === 'comercial')!
const fluxo = acharModelo('recado')!
async function preparar(id: string, acao = 'concluir', modelo: unknown = quadro) {
  const r = await conexao.query('select public.preparar_onboarding($1,$2,$3,$4,$5,$6) as estado', [id, respostas, acao, 'vender', modelo, fluxo])
  return r.rows[0].estado
}
async function empresa() {
  return (await conexao.query("insert into public.clients (nome, crm_ativo) values ('Teste onboarding', false) returning id")).rows[0].id as string
}

describe('onboarding transacional (banco local)', () => {
  it('salva, retoma, conclui uma única vez e cria apenas rascunho pausado', async () => {
    await conexao.query('begin')
    try {
      const id = await empresa()
      expect((await preparar(id, 'adiar')).status).toBe('adiado')
      expect((await conexao.query('select count(*)::int as n from public.flows where client_id=$1', [id])).rows[0].n).toBe(0)
      const primeiro = await preparar(id)
      expect(await preparar(id)).toEqual(primeiro)
      expect((await preparar(id, 'salvar')).status).toBe('concluido')
      const criado = (await conexao.query('select ativo,versao_publicada_id from public.flows where client_id=$1', [id])).rows
      expect(criado).toEqual([{ ativo: false, versao_publicada_id: null }])
      expect((await conexao.query('select count(*)::int as n from public.quadro_colunas where quadro_id=$1', [primeiro.quadroId])).rows[0].n).toBe(quadro.etapas.length)
      const conta = (await conexao.query('select objetivo,crm_ativo from public.clients where id=$1', [id])).rows[0]
      expect(conta).toEqual({ objetivo: 'vender', crm_ativo: true })
    } finally { await conexao.query('rollback') }
  })
  it('preserva funil e automação existentes, inclusive conteúdo e ativação', async () => {
    await conexao.query('begin')
    try {
      const id = await empresa()
      const q = (await conexao.query("insert into public.quadros(client_id,nome) values($1,'Meu funil') returning id", [id])).rows[0].id
      const f = (await conexao.query("insert into public.flows(client_id,nome,rascunho,ativo) values($1,'Meu fluxo',$2,true) returning id", [id, fluxo.grafo])).rows[0].id
      const estado = await preparar(id)
      expect(estado.quadroId).toBe(q)
      expect(estado.fluxoId).toBe(f)
      expect((await conexao.query('select nome,ativo from public.flows where client_id=$1', [id])).rows).toEqual([{ nome: 'Meu fluxo', ativo: true }])
      expect((await conexao.query('select nome from public.quadros where client_id=$1', [id])).rows).toEqual([{ nome: 'Meu funil' }])
    } finally { await conexao.query('rollback') }
  })
  it('falha nas etapas desfaz também o funil e a conclusão', async () => {
    await conexao.query('begin')
    try {
      const id = await empresa()
      await conexao.query('savepoint tentativa')
      await expect(preparar(id, 'concluir', { ...quadro, etapas: [{ nome: 'Inválida', tipo: 'inventado' }] })).rejects.toThrow()
      await conexao.query('rollback to savepoint tentativa')
      expect((await conexao.query('select count(*)::int as n from public.quadros where client_id=$1', [id])).rows[0].n).toBe(0)
      expect((await conexao.query('select onboarding from public.clients where id=$1', [id])).rows[0].onboarding).toBeNull()
    } finally { await conexao.query('rollback') }
  })
  it('duas conclusões simultâneas retornam os mesmos modelos e isolam outra empresa', async () => {
    const id = await empresa()
    const outra = await empresa()
    try {
      const consulta = 'select public.preparar_onboarding($1,$2,$3,$4,$5,$6) as estado'
      const args = [id, respostas, 'concluir', 'vender', quadro, fluxo]
      const [a, b] = await Promise.all([conexao.query(consulta, args), pool.query(consulta, args)])
      expect(a.rows[0].estado).toEqual(b.rows[0].estado)
      expect((await conexao.query('select count(*)::int as n from public.flows where client_id=$1', [id])).rows[0].n).toBe(1)
      expect((await conexao.query('select onboarding, objetivo, crm_ativo from public.clients where id=$1', [outra])).rows[0]).toEqual({ onboarding: null, objetivo: 'atender', crm_ativo: false })
    } finally {
      await conexao.query('delete from public.clients where id = any($1::uuid[])', [[id, outra]])
    }
  })
  it('RPC não é executável pelos papéis públicos', async () => {
    const { rows } = await conexao.query("select has_function_privilege('anon', 'public.preparar_onboarding(uuid,jsonb,text,text,jsonb,jsonb)', 'execute') as anon, has_function_privilege('authenticated', 'public.preparar_onboarding(uuid,jsonb,text,text,jsonb,jsonb)', 'execute') as autenticado")
    expect(rows[0]).toEqual({ anon: false, autenticado: false })
  })
})
