import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { criarCliente } from '../repos/clientes'
import { inserirPedido, mudarStatusDoPedido } from '../repos/pedidos'
import { criarTokenDoEntregador } from './token'

const avisar = vi.fn(async () => 'sem_contato' as const)
vi.mock('../avisar-etapa', () => ({ avisarEtapaDoPedido: (...a: unknown[]) => avisar(...(a as [])) }))

const { passoDoEntregador } = await import('./link')

/**
 * O toque do motoboy contra o Supabase de verdade: o pedido cancelado não
 * anda, e o mesmo toque duas vezes avisa uma vez só.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-ent-${Math.random().toString(36).slice(2, 8)}`
let clienteId = ''

const pedido = () =>
  inserirPedido({
    clienteId,
    contatoId: null,
    entrega: 'entrega',
    endereco: 'Rua das Flores, 10',
    observacao: null,
    totalCentavos: 5990,
    origem: 'inbox',
    criadoPor: null,
    itens: [],
  })

beforeAll(async () => {
  if (!temCredencial) return
  process.env.BETTER_AUTH_SECRET ??= 'segredo-de-teste-do-entregador'
  clienteId = (await criarCliente(`${marca} cliente`)).id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('link do entregador', () => {
  it('pedido cancelado não anda', async () => {
    const p = await pedido()
    await mudarStatusDoPedido(clienteId, p.id, ['novo'], 'cancelado')
    const r = await passoDoEntregador(criarTokenDoEntregador({ clienteId, pedidoId: p.id }), 'saiu')
    expect(r.ok).toBe(false)
    const { data } = await db().from('pedidos').select('status').eq('id', p.id).single()
    expect(data?.status).toBe('cancelado')
  })

  it('entregue duas vezes avisa uma vez', async () => {
    const p = await pedido()
    await mudarStatusDoPedido(clienteId, p.id, ['novo'], 'em_preparo')
    avisar.mockClear()
    const token = criarTokenDoEntregador({ clienteId, pedidoId: p.id })
    expect(await passoDoEntregador(token, 'entregue')).toEqual({ ok: true, status: 'entregue' })
    expect(await passoDoEntregador(token, 'entregue')).toEqual({ ok: true, status: 'entregue' })
    expect(avisar).toHaveBeenCalledTimes(1)
  })
})
