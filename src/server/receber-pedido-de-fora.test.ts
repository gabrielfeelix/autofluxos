import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PedidoDeFora } from '@/core/pedidos-de-fora'
import { db } from './db'
import { criarCliente } from './repos/clientes'

const tratarEvento = vi.fn(async () => 'sem_gatilho' as const)
vi.mock('./receber-evento', () => ({ tratarEvento: (...a: unknown[]) => tratarEvento(...(a as [])) }))

const { receberPedidoDeFora } = await import('./receber-pedido-de-fora')

/**
 * O pedido de fora até o quadro, contra o Supabase de verdade (0154).
 *
 * O que só o banco prova: o índice único `pedidos_de_fora` segurando o mesmo
 * pedido chegando duas vezes, e a troca condicional de etapa não voltando
 * atrás. O evento é mock: o que importa é quantas vezes ele sai.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-pf-${Math.random().toString(36).slice(2, 8)}`
let clienteId = ''

const base = (mudar: Partial<PedidoDeFora> = {}): PedidoDeFora => ({
  plataforma: 'cardapio_web',
  idExterno: `${marca}-1`,
  numeroExibido: '1042',
  status: 'em_preparo',
  telefone: null,
  nome: 'Ana',
  entrega: 'entrega',
  endereco: 'Rua das Flores, 10',
  totalCentavos: 5990,
  itens: [{ nome: 'Pizza grande', quantidade: 1, precoCentavos: 5990 }],
  rastreioUrl: null,
  ...mudar,
})

const linhas = async (idExterno: string) =>
  (await db().from('pedidos').select('id, status, contato_id').eq('cliente_id', clienteId).eq('id_externo', idExterno)).data ?? []

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

beforeEach(() => tratarEvento.mockClear())

describe.skipIf(!temCredencial)('receber pedido de fora', () => {
  it('o mesmo pedido duas vezes é uma linha e um evento', async () => {
    const p = base({ idExterno: `${marca}-dup`, telefone: '(44) 99876-5432' })
    expect(await receberPedidoDeFora(clienteId, p, { avisarCliente: true })).toBe('novo')
    expect(await receberPedidoDeFora(clienteId, p, { avisarCliente: true })).toBe('igual')
    expect(await linhas(p.idExterno)).toHaveLength(1)
    expect(tratarEvento).toHaveBeenCalledTimes(1)
  })

  it('aviso atrasado não volta a etapa', async () => {
    const p = base({ idExterno: `${marca}-atraso`, status: 'saiu' })
    await receberPedidoDeFora(clienteId, p, { avisarCliente: false })
    expect(await receberPedidoDeFora(clienteId, { ...p, status: 'em_preparo' }, { avisarCliente: false })).toBe('ignorado')
    expect((await linhas(p.idExterno))[0]?.status).toBe('saiu')
  })

  it('sem telefone entra no quadro sem contato e sem evento', async () => {
    const p = base({ idExterno: `${marca}-semtel`, telefone: null })
    expect(await receberPedidoDeFora(clienteId, p, { avisarCliente: true })).toBe('novo')
    expect((await linhas(p.idExterno))[0]?.contato_id).toBeNull()
    expect(tratarEvento).not.toHaveBeenCalled()
  })

  it('com o aviso desligado, telefone desconhecido não cria contato', async () => {
    const p = base({ idExterno: `${marca}-semaviso`, telefone: '(44) 99123-4567' })
    await receberPedidoDeFora(clienteId, p, { avisarCliente: false })
    expect((await linhas(p.idExterno))[0]?.contato_id).toBeNull()
    const { count } = await db().from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', clienteId).eq('wa_id', '5544991234567')
    expect(count).toBe(0)
  })
})
