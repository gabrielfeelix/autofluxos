import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { selecionaveis } from '@/core/produtos'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  arquivarProduto,
  criarProduto,
  definirPreco,
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


describe.skipIf(!temCredencial)('preço (0091)', () => {
  it('volta como número, e não como a string que o numeric entrega', async () => {
    // O supabase-js devolve `numeric` como string. Se `paraPreco` não
    // convertesse, `preco` seria "150.00" e toda comparação com número
    // responderia errado sem levantar erro nenhum.
    const novo = await criarProduto(clienteId, `${marca} com preco`, 'produto', '150,00')
    expect(novo.ok).toBe(true)
    if (!novo.ok) return

    expect(novo.produto.preco).toBe(150)
    expect(typeof novo.produto.preco).toBe('number')

    const lido = await produtoPorId(clienteId, novo.produto.id)
    expect(lido?.preco).toBe(150)
  })

  it('sem preço nasce null, e null não é zero', async () => {
    const novo = await criarProduto(clienteId, `${marca} sem preco`, 'servico')
    expect(novo.ok).toBe(true)
    if (!novo.ok) return
    expect(novo.produto.preco).toBeNull()
  })

  it('campo vazio apaga o preço em vez de zerar', async () => {
    const novo = await criarProduto(clienteId, `${marca} apaga`, 'produto', '90')
    expect(novo.ok).toBe(true)
    if (!novo.ok) return
    expect(novo.produto.preco).toBe(90)

    const apagado = await definirPreco(clienteId, novo.produto.id, '')
    expect(apagado.ok).toBe(true)
    if (!apagado.ok) return

    // O ponto: `null`, nunca 0. Zero seria uma oferta de graça que ninguém fez.
    expect(apagado.produto.preco).toBeNull()
  })

  it('zero é preço de verdade e sobrevive à ida e volta', async () => {
    const novo = await criarProduto(clienteId, `${marca} brinde`, 'produto', '0')
    expect(novo.ok).toBe(true)
    if (!novo.ok) return
    expect(novo.produto.preco).toBe(0)
    expect((await produtoPorId(clienteId, novo.produto.id))?.preco).toBe(0)
  })

  it('preço não atravessa conta', async () => {
    const meu = await criarProduto(clienteId, `${marca} preco meu`, 'produto', '10')
    expect(meu.ok).toBe(true)
    if (!meu.ok) return

    expect((await definirPreco(outroId, meu.produto.id, '999')).ok).toBe(false)
    expect((await produtoPorId(clienteId, meu.produto.id))?.preco).toBe(10)
  })
})
