import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { selecionaveis } from '@/core/produtos'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  arquivarProduto,
  criarProduto,
  listarProdutos,
  produtoPorId,
  renomearProduto,
} from './produtos'

/**
 * O catálogo contra o banco de verdade (0079).
 *
 * O que só aparece contra o Postgres, e é o que este arquivo prova:
 *
 *  - o índice **parcial** de nome único vale entre os ativos, e não entre
 *    todos: arquivar libera o nome de volta;
 *  - desarquivar em cima de um nome já tomado é recusado, com frase;
 *  - conta não vê catálogo de conta.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-prd-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('criar', () => {
  it('apara as pontas e guarda a espécie', async () => {
    const r = await criarProduto(clienteId, '  Plano Ouro  ', 'servico')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.produto.nome).toBe('Plano Ouro')
    expect(r.produto.especie).toBe('servico')
    expect(r.produto.arquivadoEm).toBeNull()
  })

  it('recusa nome repetido entre os ativos, ignorando caixa', async () => {
    const r = await criarProduto(clienteId, 'plano OURO', 'produto')
    expect(r).toEqual({ ok: false, motivo: 'já existe "plano OURO" no catálogo' })
  })

  it('o mesmo nome em outra conta é outro item', async () => {
    expect((await criarProduto(outroId, 'Plano Ouro', 'produto')).ok).toBe(true)
  })

  it('recusa nome vazio antes de ir ao banco', async () => {
    expect((await criarProduto(clienteId, '   ', 'produto')).ok).toBe(false)
  })
})

describe.skipIf(!temCredencial)('arquivar preserva, e não apaga', () => {
  it('arquivado some da escolha e continua legível pelo id', async () => {
    const criado = await criarProduto(clienteId, `${marca} antigo`, 'produto')
    expect(criado.ok).toBe(true)
    if (!criado.ok) return

    const arquivado = await arquivarProduto(clienteId, criado.produto.id, true)
    expect(arquivado.ok).toBe(true)

    // Continua no banco, com a data. É o que faz a venda de março ainda achar
    // o nome do que foi arquivado em setembro.
    const lido = await produtoPorId(clienteId, criado.produto.id)
    expect(lido?.arquivadoEm).not.toBeNull()

    // Mas sai da lista de escolha.
    const lista = await listarProdutos(clienteId)
    expect(selecionaveis(lista).map((p) => p.id)).not.toContain(criado.produto.id)
    expect(lista.map((p) => p.id)).toContain(criado.produto.id)
  })

  it('arquivar libera o nome, porque o índice é parcial', async () => {
    const nome = `${marca} reaproveitado`

    const primeiro = await criarProduto(clienteId, nome, 'produto')
    expect(primeiro.ok).toBe(true)
    if (!primeiro.ok) return

    // Com o primeiro ativo, o nome está tomado.
    expect((await criarProduto(clienteId, nome, 'produto')).ok).toBe(false)

    await arquivarProduto(clienteId, primeiro.produto.id, true)

    // Arquivado, o nome volta a ser usável: o índice só olha os ativos.
    const segundo = await criarProduto(clienteId, nome, 'produto')
    expect(segundo.ok).toBe(true)
    if (!segundo.ok) return

    // E agora desarquivar o primeiro colidiria: a recusa precisa dizer o que
    // fazer, porque o caminho não é óbvio para quem só clicou em "desarquivar".
    const volta = await arquivarProduto(clienteId, primeiro.produto.id, false)
    expect(volta.ok).toBe(false)
    if (volta.ok) return
    expect(volta.motivo).toContain('Renomeie um dos dois')
  })
})

describe.skipIf(!temCredencial)('isolamento por conta', () => {
  it('não lê, não renomeia e não arquiva item de outra conta', async () => {
    const meu = await criarProduto(clienteId, `${marca} so meu`, 'produto')
    expect(meu.ok).toBe(true)
    if (!meu.ok) return

    // `service_role` ignora RLS: quem isola é o client_id em cada consulta.
    expect(await produtoPorId(outroId, meu.produto.id)).toBeNull()
    expect((await renomearProduto(outroId, meu.produto.id, 'invadido')).ok).toBe(false)
    expect((await arquivarProduto(outroId, meu.produto.id, true)).ok).toBe(false)

    // E o nome continua o que era.
    expect((await produtoPorId(clienteId, meu.produto.id))?.nome).toBe(`${marca} so meu`)
  })

  it('id torto não derruba a leitura', async () => {
    expect(await produtoPorId(clienteId, 'nao-e-uuid')).toBeNull()
  })
})
