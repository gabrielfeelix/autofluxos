import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from '../repos/clientes'
import { acharOuCriarContato } from '../repos/conversas'
import { criarQuadro, listarCartoes, porNoQuadro } from '../repos/quadros'
import { vendaDoCartao } from '../repos/vendas'
import { cancelarVendaEResolver, registrarVendaEConcluir } from './registrar-venda'

/**
 * A venda atômica contra o banco (0080, T5.2).
 *
 * O que só o Postgres prova, e é a razão desta migration existir:
 *
 *  1. **venda e fechamento valem juntos** — não há instante em que o cartão
 *     está ganho sem venda válida, nem venda apontando para cartão aberto;
 *  2. **duplo clique devolve a mesma venda**, pela chave da operação, e não
 *     uma segunda compra (RB-30, A13);
 *  3. **cancelar e resolver valem juntos**, e cancelar não apaga (RB-31).
 *
 * O teste de corrida do item 2 foi verificado **nos dois sentidos**: ele falha
 * contra uma implementação que não seja idempotente, e passa contra a 0080.
 * Teste de concorrência que nunca se viu falhar não prova nada.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-vnd-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')

let clienteId = ''
let quadroId = ''
let contador = 0

/** Um cartão aberto novo, para cada cenário começar limpo. */
async function cartaoNovo(): Promise<string> {
  contador += 1
  const contato = await acharOuCriarContato(
    clienteId,
    `5511${seed}${String(contador).padStart(2, '0')}`,
    `Pessoa ${contador}`,
  )
  await porNoQuadro(clienteId, quadroId, [contato.id])
  const cartoes = await listarCartoes(clienteId, quadroId)
  const meu = cartoes.find((c) => c.contatoId === contato.id)
  if (!meu) throw new Error('o cartão não foi criado')
  return meu.id
}

const HOJE = new Date().toISOString().slice(0, 10)

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  const quadro = await criarQuadro(clienteId, `${marca} comercial`)
  if (quadro.ok) quadroId = quadro.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('registrar venda fecha a oportunidade junto', () => {
  it('grava venda, itens e conclusão, e deixa o cartão ganho', async () => {
    const cartaoId = await cartaoNovo()

    const r = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 1500,
      itens: [{ descricao: 'Plano trimestral', quantidade: 1, valorUnitario: 1500 }],
      chaveDaOperacao: `venda:${cartaoId}:1`,
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.repetida).toBe(false)
    expect(r.venda.valorTotal).toBe(1500)

    const cartao = (await listarCartoes(clienteId, quadroId)).find((c) => c.id === cartaoId)
    expect(cartao?.situacao).toBe('ganha')
    expect((await vendaDoCartao(clienteId, cartaoId))?.id).toBe(r.venda.vendaId)

    const itens = await db().from('venda_itens').select('descricao').eq('venda_id', r.venda.vendaId)
    expect(itens.data).toHaveLength(1)
  })

  it('valor desconhecido continua desconhecido, e não vira zero', async () => {
    const cartaoId = await cartaoNovo()

    // RB-30: "não trocar desconhecido por zero". `null` é informação.
    const r = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: null,
      chaveDaOperacao: `venda:${cartaoId}:sem-valor`,
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.venda.valorTotal).toBeNull()
    expect((await vendaDoCartao(clienteId, cartaoId))?.valorTotal).toBeNull()
  })

  it('duas chamadas simultâneas com a mesma chave produzem UMA venda', async () => {
    const cartaoId = await cartaoNovo()
    const chave = `venda:${cartaoId}:corrida`

    const pedido = {
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 900,
      chaveDaOperacao: chave,
    }

    const [a, b] = await Promise.all([
      registrarVendaEConcluir(pedido),
      registrarVendaEConcluir(pedido),
    ])

    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    // A mesma venda para as duas: uma escreveu, a outra encontrou.
    expect(a.venda.vendaId).toBe(b.venda.vendaId)
    expect([a.repetida, b.repetida].filter(Boolean)).toHaveLength(1)

    const todas = await db()
      .from('vendas')
      .select('id')
      .eq('cartao_id', cartaoId)
    expect(todas.data).toHaveLength(1)
  })

  it('ganhar de novo um cartão já ganho não cria segunda compra válida', async () => {
    const cartaoId = await cartaoNovo()

    expect(
      (
        await registrarVendaEConcluir({
          clienteId,
          cartaoId,
          dataDaVenda: HOJE,
          valorTotal: 100,
          chaveDaOperacao: `venda:${cartaoId}:primeira`,
        })
      ).ok,
    ).toBe(true)

    // Chave nova, cartão já fechado: a função devolve a venda que existe, e
    // não uma segunda. É o retry que reconhece a própria operação.
    const segunda = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 999,
      chaveDaOperacao: `venda:${cartaoId}:segunda`,
    })

    expect(segunda.ok).toBe(true)
    if (!segunda.ok) return
    expect(segunda.repetida).toBe(true)
    expect(segunda.venda.valorTotal).toBe(100)

    const todas = await db().from('vendas').select('id').eq('cartao_id', cartaoId)
    expect(todas.data).toHaveLength(1)
  })

  it('recusa data no futuro antes de tocar o banco', async () => {
    const cartaoId = await cartaoNovo()
    const daquiAUmAno = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)

    const r = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: daquiAUmAno,
      chaveDaOperacao: `venda:${cartaoId}:futuro`,
    })
    expect(r.ok).toBe(false)

    // E o cartão continua aberto: a recusa não pode ter fechado nada.
    const cartao = (await listarCartoes(clienteId, quadroId)).find((c) => c.id === cartaoId)
    expect(cartao?.situacao).toBe('aberta')
  })

  it('não registra venda em cartão de outra conta', async () => {
    const cartaoId = await cartaoNovo()
    const outro = (await criarCliente(`${marca} intruso`)).id

    const r = await registrarVendaEConcluir({
      clienteId: outro,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 1,
      chaveDaOperacao: `venda:${cartaoId}:intruso`,
    })
    expect(r.ok).toBe(false)

    await db().from('clients').delete().eq('id', outro)
  })
})

describe.skipIf(!temCredencial)('cancelar resolve a oportunidade junto (RB-31)', () => {
  it('cancelar com reabrir devolve o cartão para aberta, e não apaga a venda', async () => {
    const cartaoId = await cartaoNovo()
    const registro = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 500,
      chaveDaOperacao: `venda:${cartaoId}:cancelar`,
    })
    expect(registro.ok).toBe(true)
    if (!registro.ok) return

    const r = await cancelarVendaEResolver({
      clienteId,
      vendaId: registro.venda.vendaId,
      motivo: 'cliente desistiu',
      destino: 'reabrir',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.situacaoDoCartao).toBe('aberta')

    // O registro continua existindo, cancelado. Apagar tornaria impossível
    // explicar por que o total do mês mudou.
    const linha = await db()
      .from('vendas')
      .select('situacao, motivo_do_cancelamento')
      .eq('id', registro.venda.vendaId)
      .single()
    expect((linha.data as { situacao: string }).situacao).toBe('cancelada')

    // E sai dos indicadores: não há mais venda válida naquele cartão.
    expect(await vendaDoCartao(clienteId, cartaoId)).toBeNull()

    // A trilha de auditoria guardou o "antes".
    const revisoes = await db()
      .from('revisoes_de_venda')
      .select('tipo, antes')
      .eq('venda_id', registro.venda.vendaId)
    expect(revisoes.data).toHaveLength(1)
  })

  it('cancelar com perdida exige motivo da perda', async () => {
    const cartaoId = await cartaoNovo()
    const registro = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 300,
      chaveDaOperacao: `venda:${cartaoId}:perder`,
    })
    expect(registro.ok).toBe(true)
    if (!registro.ok) return

    const semMotivo = await cancelarVendaEResolver({
      clienteId,
      vendaId: registro.venda.vendaId,
      motivo: 'erro de lançamento',
      destino: 'perdida',
    })
    expect(semMotivo.ok).toBe(false)

    const comMotivo = await cancelarVendaEResolver({
      clienteId,
      vendaId: registro.venda.vendaId,
      motivo: 'erro de lançamento',
      destino: 'perdida',
      motivoDaPerda: 'preço',
    })
    expect(comMotivo.ok).toBe(true)
    if (!comMotivo.ok) return
    expect(comMotivo.situacaoDoCartao).toBe('perdida')
  })

  it('cancelar sem motivo é recusado, e cancelar duas vezes não empilha revisão', async () => {
    const cartaoId = await cartaoNovo()
    const registro = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 700,
      chaveDaOperacao: `venda:${cartaoId}:duplo`,
    })
    expect(registro.ok).toBe(true)
    if (!registro.ok) return

    expect(
      (
        await cancelarVendaEResolver({
          clienteId,
          vendaId: registro.venda.vendaId,
          motivo: '   ',
          destino: 'reabrir',
        })
      ).ok,
    ).toBe(false)

    const pedido = {
      clienteId,
      vendaId: registro.venda.vendaId,
      motivo: 'duplicado',
      destino: 'reabrir' as const,
    }
    await cancelarVendaEResolver(pedido)
    await cancelarVendaEResolver(pedido)

    // O segundo cancelamento encontra a venda já cancelada e não escreve de
    // novo: uma revisão, não duas.
    const revisoes = await db()
      .from('revisoes_de_venda')
      .select('id')
      .eq('venda_id', registro.venda.vendaId)
    expect(revisoes.data).toHaveLength(1)
  })

  it('não cancela venda de outra conta', async () => {
    const cartaoId = await cartaoNovo()
    const registro = await registrarVendaEConcluir({
      clienteId,
      cartaoId,
      dataDaVenda: HOJE,
      valorTotal: 50,
      chaveDaOperacao: `venda:${cartaoId}:alheia`,
    })
    expect(registro.ok).toBe(true)
    if (!registro.ok) return

    const outro = (await criarCliente(`${marca} vizinho`)).id
    const r = await cancelarVendaEResolver({
      clienteId: outro,
      vendaId: registro.venda.vendaId,
      motivo: 'invadindo',
      destino: 'reabrir',
    })
    expect(r.ok).toBe(false)

    // E a venda continua válida.
    expect((await vendaDoCartao(clienteId, cartaoId))?.id).toBe(registro.venda.vendaId)
    await db().from('clients').delete().eq('id', outro)
  })
})
