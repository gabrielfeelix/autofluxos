import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarQuadro, listarCartoes, porNoQuadro } from './quadros'
import {
  cancelarVenda,
  registrarVenda,
  resumoDeVendas,
  vendaDoCartao,
} from './vendas'

/**
 * A venda contra o banco de verdade (0071).
 *
 * O que só aparece aqui, e não no teste puro de `core/vendas.ts`: a
 * idempotência sob corrida, o índice de uma venda válida por oportunidade, e o
 * `numeric` que o supabase-js entrega como string.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-vnd-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let contatoId = ''
let quadroId = ''

/** Abre uma oportunidade nova para este contato e devolve o cartão. */
async function novaOportunidade(contato: string): Promise<string> {
  await porNoQuadro(clienteId, quadroId, [contato])
  const cartoes = await listarCartoes(clienteId, quadroId)
  const aberto = cartoes.find((c) => c.contatoId === contato && (c.situacao ?? 'aberta') === 'aberta')
  if (!aberto) throw new Error('não abriu cartão')
  return aberto.id
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const pessoa = await acharOuCriarContato(clienteId, `55119${seed}`, 'Compradora')
  contatoId = pessoa.id

  const quadro = await criarQuadro(clienteId, `${marca} comercial`, 'comercial')
  if (!quadro.ok) throw new Error(quadro.motivo)
  quadroId = quadro.id
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('registrar venda', () => {
  it('grava e devolve o que foi gravado', async () => {
    const cartao = await novaOportunidade(contatoId)
    const feito = await registrarVenda({
      clienteId,
      contatoId,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 350.5,
      nota: 'primeira',
    })

    expect(feito.ok).toBe(true)
    if (!feito.ok) return
    expect(feito.repetida).toBe(false)
    // `numeric` volta como string do PostgREST; o repo precisa converter.
    expect(feito.venda.valorTotal).toBe(350.5)
    expect(typeof feito.venda.valorTotal).toBe('number')
  })

  /**
   * O A13. Duplo clique manda a mesma operação duas vezes; a segunda tem que
   * receber a venda da primeira, e não criar outra.
   */
  it('duplo clique com a mesma chave devolve a mesma venda', async () => {
    const cartao = await novaOportunidade(
      (await acharOuCriarContato(clienteId, `55219${seed}`, 'Duplo clique')).id,
    )
    const contato = (await listarCartoes(clienteId, quadroId)).find((c) => c.id === cartao)!
      .contatoId

    const pedido = {
      clienteId,
      contatoId: contato,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 100,
      chaveDaOperacao: `${marca}-duplo`,
    }

    const primeira = await registrarVenda(pedido)
    const segunda = await registrarVenda(pedido)

    expect(primeira.ok && segunda.ok).toBe(true)
    if (!primeira.ok || !segunda.ok) return

    expect(segunda.repetida).toBe(true)
    expect(segunda.venda.id).toBe(primeira.venda.id)

    // E o resumo não pode ter contado duas.
    expect((await resumoDeVendas(clienteId, contato)).compras).toBe(1)
  })

  /** O mesmo, com as duas requisições saindo juntas. */
  it('duas requisições simultâneas produzem uma venda só', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55319${seed}`, 'Corrida')
    const cartao = await novaOportunidade(pessoa.id)

    const pedido = {
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 77,
      chaveDaOperacao: `${marca}-corrida`,
    }

    const [a, b] = await Promise.all([registrarVenda(pedido), registrarVenda(pedido)])

    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.venda.id).toBe(b.venda.id)
    expect((await resumoDeVendas(clienteId, pessoa.id)).compras).toBe(1)
  })

  /** RB-05: no máximo uma venda válida por oportunidade. */
  it('recusa a segunda venda da mesma oportunidade, com frase', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55419${seed}`, 'Dois registros')
    const cartao = await novaOportunidade(pessoa.id)

    await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 100,
    })
    const segunda = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-19',
      valorTotal: 200,
    })

    expect(segunda.ok).toBe(false)
    expect(segunda.ok === false && segunda.motivo).toContain('já tem uma venda')
  })

  /** A14: comprou, não se sabe quanto. Não pode virar zero. */
  it('aceita compra sem valor e não a transforma em zero', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55519${seed}`, 'Sem valor')
    const cartao = await novaOportunidade(pessoa.id)

    const feito = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: null,
    })
    expect(feito.ok).toBe(true)
    if (!feito.ok) return
    expect(feito.venda.valorTotal).toBeNull()

    const resumo = await resumoDeVendas(clienteId, pessoa.id)
    expect(resumo.compras).toBe(1)
    expect(resumo.totalConhecido).toBe(0)
    // A informação que impede a tela de mentir:
    expect(resumo.semValor).toBe(1)
  })

  it('grava os itens com nome e valor da época', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55619${seed}`, 'Com itens')
    const cartao = await novaOportunidade(pessoa.id)

    const feito = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 300,
      itens: [{ descricao: 'Plano XYZ', quantidade: 2, valorUnitario: 150 }],
    })
    expect(feito.ok).toBe(true)
    if (!feito.ok) return

    const { data } = await db().from('venda_itens').select('descricao').eq('venda_id', feito.venda.id)
    expect(data).toHaveLength(1)
  })

  /** Total que contradiz os itens é recusado antes de tocar o banco (RB-30). */
  it('recusa total que não bate com os itens', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55719${seed}`, 'Contradição')
    const cartao = await novaOportunidade(pessoa.id)

    const feito = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 500,
      itens: [{ descricao: 'Plano', quantidade: 2, valorUnitario: 150 }],
    })
    expect(feito.ok).toBe(false)
    expect(await vendaDoCartao(clienteId, cartao)).toBeNull()
  })
})

describe.skipIf(!temCredencial)('cancelar venda (A15)', () => {
  it('sai dos indicadores sem apagar o registro, e libera nova venda', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55819${seed}`, 'Cancelamento')
    const cartao = await novaOportunidade(pessoa.id)

    const feito = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 900,
    })
    if (!feito.ok) throw new Error(feito.motivo)

    expect((await resumoDeVendas(clienteId, pessoa.id)).compras).toBe(1)

    const cancelado = await cancelarVenda(clienteId, feito.venda.id, 'cliente desistiu')
    expect(cancelado.ok).toBe(true)

    // Some dos indicadores…
    const resumo = await resumoDeVendas(clienteId, pessoa.id)
    expect(resumo.compras).toBe(0)
    expect(resumo.totalConhecido).toBe(0)
    expect(resumo.ultimaEm).toBeNull()

    // …mas o registro continua lá, com o motivo.
    const { data } = await db()
      .from('vendas')
      .select('situacao, motivo_do_cancelamento')
      .eq('id', feito.venda.id)
      .single()
    expect((data as { situacao: string }).situacao).toBe('cancelada')
    expect((data as { motivo_do_cancelamento: string }).motivo_do_cancelamento).toBe(
      'cliente desistiu',
    )

    // E a oportunidade volta a aceitar uma venda: é o que "corrigir" exige.
    const corrigida = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
      valorTotal: 950,
    })
    expect(corrigida.ok).toBe(true)
  })

  it('exige motivo', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `55919${seed}`, 'Sem motivo')
    const cartao = await novaOportunidade(pessoa.id)
    const feito = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: cartao,
      dataDaVenda: '2026-09-18',
    })
    if (!feito.ok) throw new Error(feito.motivo)

    expect((await cancelarVenda(clienteId, feito.venda.id, '   ')).ok).toBe(false)
  })
})

/**
 * O A12, agora do lado que funciona: a mesma pessoa pode ter duas
 * oportunidades no mesmo processo, e cada uma com a sua compra.
 */
describe.skipIf(!temCredencial)('recompra no mesmo processo (A12)', () => {
  it('fechado libera nova ocorrência, e as duas vendas coexistem', async () => {
    const pessoa = await acharOuCriarContato(clienteId, `56019${seed}`, 'Recompra')

    const primeiro = await novaOportunidade(pessoa.id)
    const v1 = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: primeiro,
      dataDaVenda: '2026-08-01',
      valorTotal: 1200,
    })
    if (!v1.ok) throw new Error(v1.motivo)

    // Fecha a primeira: é o que libera o índice parcial.
    await db().from('quadro_cartoes').update({ situacao: 'ganha' }).eq('id', primeiro)

    // A renovação: outra ocorrência, mesma pessoa, mesmo quadro.
    const segundo = await novaOportunidade(pessoa.id)
    expect(segundo).not.toBe(primeiro)

    const v2 = await registrarVenda({
      clienteId,
      contatoId: pessoa.id,
      cartaoId: segundo,
      dataDaVenda: '2026-09-15',
      valorTotal: 1500,
    })
    expect(v2.ok).toBe(true)

    const resumo = await resumoDeVendas(clienteId, pessoa.id)
    expect(resumo.compras).toBe(2)
    expect(resumo.totalConhecido).toBe(2700)
    expect(resumo.ultimaEm).toBe('2026-09-15')
  })
})
