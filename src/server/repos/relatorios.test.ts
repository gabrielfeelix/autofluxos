import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Periodo } from '@/core/relatorios'
import { db } from '../db'
import { criarCliente } from './clientes'
import { serieDoPeriodo, totaisDoPeriodo } from './relatorios'

/**
 * Os números dos Relatórios (plano de UX, 11.1).
 *
 * O que precisa ser provado: o escopo corta **antes** de somar (quem vê só os
 * próprios contatos nunca recebe o agregado da conta), e o período conta pelo
 * dia de São Paulo, não pelo de UTC.
 */
const temCredencial = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.DATABASE_URL,
)
const marca = `zz-rel-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
const ana = crypto.randomUUID()
const bruno = crypto.randomUUID()
let canalId = ''
let versaoId = ''
let indice = 0

// 22/09 às 22h30 em Brasília, que já é 23/09 em UTC.
const NOITE_DO_DIA_22 = '2026-09-23T01:30:00Z'
const PERIODO: Periodo = { de: '2026-09-20', ate: '2026-09-22', dias: 3, atalho: null }

async function conversa(dono: string | null, quando: string, comFila: boolean) {
  indice += 1
  const { data: contato } = await db()
    .from('contacts')
    .insert({
      client_id: clienteId,
      wa_id: `5511${seed}${String(indice).padStart(2, '0')}`,
      atribuido_a: dono,
      criado_em: quando,
    })
    .select('id')
    .single()
  const { data: sessao } = await db()
    .from('sessions')
    .insert({
      contact_id: contato!.id,
      channel_id: canalId,
      flow_version_id: versaoId,
      status: comFila ? 'humano' : 'encerrada',
      criado_em: quando,
    })
    .select('id')
    .single()
  if (comFila) {
    await db()
      .from('handoffs')
      .insert({ session_id: sessao!.id, motivo: 'teste', origem: 'prevista', criado_em: quando })
  }
  await db().from('avaliacoes').insert({ cliente_id: clienteId, contato_id: contato!.id, nota: 10, criada_em: quando })
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  await db()
    .from('af_usuarios')
    .insert([
      { id: ana, name: 'Ana', email: `${marca}-ana@local.test`, emailVerified: true },
      { id: bruno, name: 'Bruno', email: `${marca}-bruno@local.test`, emailVerified: true },
    ])

  const grafo = { inicio: 'a', nodes: [{ id: 'a', type: 'mensagem', position: { x: 0, y: 0 }, data: { partes: [{ tipo: 'texto', texto: 'oi' }] } }], edges: [] }
  const { data: fluxo } = await db().from('flows').insert({ client_id: clienteId, nome: marca, rascunho: grafo }).select('id').single()
  const { data: versao } = await db().from('flow_versions').insert({ flow_id: fluxo!.id, versao: 1, grafo }).select('id').single()
  const { data: canal } = await db().from('channels').insert({ client_id: clienteId, phone_number_id: `test-${marca}` }).select('id').single()
  versaoId = versao!.id
  canalId = canal!.id

  // Ana: duas conversas, uma foi para a equipe. Bruno: três, todas com a equipe.
  // Sem dono: uma. E uma fora do período, que não pode entrar em nada.
  await conversa(ana, '2026-09-20T15:00:00Z', false)
  await conversa(ana, NOITE_DO_DIA_22, true)
  await conversa(bruno, '2026-09-21T15:00:00Z', true)
  await conversa(bruno, '2026-09-21T16:00:00Z', true)
  await conversa(bruno, '2026-09-22T12:00:00Z', true)
  await conversa(null, '2026-09-22T12:00:00Z', false)
  await conversa(ana, '2026-09-23T12:00:00Z', true)
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
  await db().from('af_usuarios').delete().in('id', [ana, bruno])
})

describe.skipIf(!temCredencial)('relatórios por período', () => {
  it('a conta inteira soma todo mundo, inclusive quem está sem responsável', async () => {
    const t = await totaisDoPeriodo(clienteId, PERIODO, null)
    expect(t.conversas).toBe(6)
    expect(t.contatosNovos).toBe(6)
    expect(t.tempos.entraramNaFila).toBe(4)
    expect(t.satisfacao.respostas).toBe(6)
  })

  it('relatório de quem vê só os próprios não soma a conta inteira', async () => {
    const t = await totaisDoPeriodo(clienteId, PERIODO, [ana])
    expect(t.conversas).toBe(2)
    expect(t.contatosNovos).toBe(2)
    expect(t.tempos.entraramNaFila).toBe(1)
    expect(t.desfechos.bot).toBe(1)
    expect(t.satisfacao.respostas).toBe(2)

    const serie = await serieDoPeriodo(clienteId, PERIODO, [ana])
    expect(serie.reduce((s, d) => s + d.conversas, 0)).toBe(2)
  })

  it('escopo sem ninguém dá zero, e não a conta inteira', async () => {
    const t = await totaisDoPeriodo(clienteId, PERIODO, [])
    expect(t.conversas).toBe(0)
    expect(t.satisfacao.nps).toBeNull()
  })

  it('a conversa das 22h30 de Brasília conta no dia 22, não no 23', async () => {
    const serie = await serieDoPeriodo(clienteId, PERIODO, [ana])
    expect(serie.find((d) => d.dia === '2026-09-22')?.conversas).toBe(1)
    expect(serie.find((d) => d.dia === '2026-09-23')).toBeUndefined()
  })
})
