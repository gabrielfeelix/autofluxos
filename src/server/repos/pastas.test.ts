import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fluxoSchema } from '@/core/flow/schema'
import { db } from '../db'
import { criarCliente } from './clientes'
import { criarFluxo } from './fluxos'
import { apagarPasta, criarPasta, listarPastas, moverFluxo, renomearPasta } from './pastas'

/**
 * Pastas são só rótulo (0029): renomear e apagar não podem mexer em desenho
 * nenhum (A15). Contra o banco de verdade, porque o que se prova aqui é o
 * `update` por id e o `on delete set null`.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-pasta-${Math.random().toString(36).slice(2, 8)}`

const desenho = fluxoSchema.parse({
  inicio: 'oi',
  nodes: [
    { id: 'oi', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'Olá!' } },
    { id: 'h', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
  ],
  edges: [{ id: 'e1', source: 'oi', target: 'h' }],
})

let clienteId = ''
let pastaId = ''
let fluxoId = ''

async function pastaDoFluxo() {
  const { data } = await db().from('flows').select('pasta_id').eq('id', fluxoId).single()
  return (data as { pasta_id: string | null }).pasta_id
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  await criarPasta(clienteId, 'Recepção')
  pastaId = (await listarPastas(clienteId))[0]!.id
  fluxoId = (await criarFluxo(clienteId, `${marca} fluxo`, desenho)).id
  await moverFluxo(clienteId, fluxoId, pastaId)
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('pastas', () => {
  it('renomear não mexe nos fluxos da pasta', async () => {
    expect(await renomearPasta(clienteId, pastaId, '  Atendimento  ')).toEqual({ ok: true })
    expect(await listarPastas(clienteId)).toEqual([{ id: pastaId, nome: 'Atendimento' }])
    expect(await pastaDoFluxo()).toBe(pastaId)
  })

  it('renomear recusa nome vazio, nome repetido e pasta de outra conta', async () => {
    expect(await renomearPasta(clienteId, pastaId, '   ')).toMatchObject({ ok: false })
    await criarPasta(clienteId, 'Vendas')
    expect(await renomearPasta(clienteId, pastaId, 'Vendas')).toMatchObject({ ok: false })
    const outra = await criarCliente(`${marca} outra`)
    try {
      expect(await renomearPasta(outra.id, pastaId, 'Invadida')).toEqual({
        ok: false,
        motivo: 'esta pasta não existe mais',
      })
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })

  it('apagar pasta devolve os fluxos para Sem pasta', async () => {
    expect(await apagarPasta(clienteId, pastaId)).toBe(true)
    expect(await pastaDoFluxo()).toBeNull()
  })
})
