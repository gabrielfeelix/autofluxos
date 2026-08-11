import { afterAll, describe, expect, it } from 'vitest'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { acharCliente, criarCliente, listarClientes } from './clientes'
import { acharFluxo, criarFluxo, listarFluxos, salvarRascunho } from './fluxos'

/**
 * Fala com o Supabase de verdade. Não tem mock: o que a gente precisa saber é
 * se o banco aceita o que a gente manda, e mock nenhum responde isso.
 *
 * Cria tudo com um nome carimbado e apaga no fim. Se rodar sem `.env`, pula.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-teste-${Math.random().toString(36).slice(2, 8)}`
const criados: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of criados) {
    // `on delete cascade` leva os fluxos junto.
    await db().from('clients').delete().eq('id', id)
  }
})

describe.skipIf(!temCredencial)('repos contra o Supabase', () => {
  it('cria um cliente e acha ele depois', async () => {
    const criado = await criarCliente(`${marca} cliente`)
    criados.push(criado.id)

    expect(criado.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(criado.iaHabilitada).toBe(false)
    expect(criado.contextoNegocio).toBe('')

    const achado = await acharCliente(criado.id)
    expect(achado?.nome).toBe(`${marca} cliente`)

    const todos = await listarClientes()
    expect(todos.some((c) => c.id === criado.id)).toBe(true)
  })

  it('cria um fluxo, guarda o grafo e devolve ele validado', async () => {
    const cliente = await criarCliente(`${marca} com fluxo`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} triagem`, fluxoNovo())

    expect(fluxo.clienteId).toBe(cliente.id)
    expect(fluxo.rascunho.inicio).toBe('abertura')
    expect(fluxo.rascunho.nodes).toHaveLength(4)

    const lista = await listarFluxos(cliente.id)
    expect(lista.map((f) => f.id)).toEqual([fluxo.id])
  })

  it('salva o rascunho e a leitura seguinte traz o grafo novo', async () => {
    const cliente = await criarCliente(`${marca} rascunho`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())

    const mexido = structuredClone(fluxo.rascunho)
    const abertura = mexido.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'texto trocado'

    await salvarRascunho(fluxo.id, mexido)

    const relido = await acharFluxo(fluxo.id)
    const aberturaRelida = relido?.rascunho.nodes.find((n) => n.id === 'abertura')
    expect(aberturaRelida?.type === 'mensagem' && aberturaRelida.data.texto).toBe('texto trocado')
  })

  it('recusa gravar grafo inválido em vez de sujar o banco', async () => {
    const cliente = await criarCliente(`${marca} invalido`)
    criados.push(cliente.id)

    const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())
    const torto = { inicio: 'abertura', nodes: [], edges: [] }

    await expect(salvarRascunho(fluxo.id, torto as never)).rejects.toThrow()
  })

  it('devolve null para id que não existe', async () => {
    expect(await acharCliente('00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await acharFluxo('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
