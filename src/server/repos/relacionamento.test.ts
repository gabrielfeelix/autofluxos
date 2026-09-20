import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FAIXAS_PADRAO } from '@/core/relacionamento'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarQuadro, fecharCartao, listarCartoes, porNoQuadro } from './quadros'
import { registrarVenda } from './vendas'
import {
  clientesSumidos,
  definirFaixas,
  faixasDaConta,
  relacionamentoDeMuitos,
} from './relacionamento'

/**
 * O relacionamento contra o banco de verdade (0070, e a T8.1 em cima dele).
 *
 * ---------------------------------------------------------------------------
 * Por que a prova da T8.1 mora aqui, e não numa conferência na produção
 * ---------------------------------------------------------------------------
 *
 * A produção tem hoje **zero vendas, zero cartões ganhos e zero quadros
 * comerciais**: todo contato lê `sem_compra`, e a correção não muda número
 * visível nenhum lá. Ela impede o número errado **na primeira vez que alguém
 * vender**, e o único lugar onde isso dá para provar antes de acontecer é um
 * fixture que tenha as duas coisas ao mesmo tempo: um cartão ganho que não é
 * venda, e uma venda de verdade.
 *
 * O que só aparece aqui e não no teste puro de `core/relacionamento.ts`: a soma
 * de `numeric` em lote, que o supabase-js entrega como string e que somada sem
 * converter concatena; e a regra de quem entra na régua de retomada.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-rel-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let ouro = ''
let bronze = ''
let novato = ''
let importado = ''
let atendido = ''
let semValor = ''
let quadroId = ''
let posVendaId = ''
let atendimentoId = ''

/** Mexe o relógio da pessoa para trás, que é o que o teste de recência precisa. */
async function falouHaDias(contatoId: string, dias: number) {
  await db()
    .from('contacts')
    .update({ ultima_mensagem_em: new Date(Date.now() - dias * 86_400_000).toISOString() })
    .eq('id', contatoId)
}

/**
 * Ganha o cartão **e registra a venda**: a compra de verdade.
 *
 * O quadro é parâmetro porque é um cartão por pessoa em cada quadro
 * (`quadro_cartoes_unico_idx`, 0032): a segunda compra do mesmo cliente não é
 * outro cartão no mesmo funil, é um cartão no funil seguinte, que é exatamente
 * o desenho dos funis encadeados da 0058.
 *
 * `valor` `null` é o caso da RB-06: a venda aconteceu e ninguém digitou quanto.
 */
async function vender(contatoId: string, valor: number | null, emQuadro = quadroId) {
  const cartaoId = await ganharCartao(contatoId, valor, emQuadro)
  const r = await registrarVenda({
    clienteId,
    contatoId,
    cartaoId,
    dataDaVenda: new Date().toISOString().slice(0, 10),
    valorTotal: valor,
  })
  if (!r.ok) throw new Error(`o fixture não conseguiu vender: ${r.motivo}`)
}

/**
 * Ganha o cartão e **não** registra venda: o caso que a T8.1 veio separar.
 *
 * É o "Resolvido" do quadro de atendimento, o "Qualificado" da captação, o
 * "Compareceu" da agenda. Ganhar ali quer dizer que o processo terminou bem, e
 * não que alguém pagou alguma coisa (RB-32).
 */
async function ganharCartao(contatoId: string, valor: number | null, emQuadro: string) {
  await porNoQuadro(clienteId, emQuadro, [contatoId])
  const cartao = (await listarCartoes(clienteId, emQuadro)).find((c) => c.contatoId === contatoId)!
  await fecharCartao(clienteId, cartao.id, 'ganha', { valor, motivo: null, titulo: 'Plano' })
  return cartao.id
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const quadro = await criarQuadro(clienteId, `${marca} vendas`)
  if (quadro.ok) quadroId = quadro.id
  const posVenda = await criarQuadro(clienteId, `${marca} pós-venda`)
  if (posVenda.ok) posVendaId = posVenda.id
  const atendimento = await criarQuadro(clienteId, `${marca} atendimento`)
  if (atendimento.ok) atendimentoId = atendimento.id

  ouro = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ouro')).id
  bronze = (await acharOuCriarContato(clienteId, `5511${seed}02`, 'Bronze')).id
  novato = (await acharOuCriarContato(clienteId, `5511${seed}03`, 'Novato')).id
  importado = (await acharOuCriarContato(clienteId, `5511${seed}04`, 'Importado')).id
  atendido = (await acharOuCriarContato(clienteId, `5511${seed}05`, 'Atendido')).id
  semValor = (await acharOuCriarContato(clienteId, `5511${seed}06`, 'Sem valor')).id

  await vender(ouro, 4000)
  await vender(bronze, 200)
  await vender(importado, 3000)
  // Venda sem valor informado: comprou, e ninguém digitou quanto (RB-06).
  await vender(semValor, null)
  // Cartão ganho no quadro de atendimento, e **nenhuma venda**: a dúvida foi
  // resolvida. Este contato é a razão de ser desta tarefa.
  await ganharCartao(atendido, 900, atendimentoId)
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('as faixas da conta', () => {
  it('nasce com o padrão do produto', async () => {
    expect(await faixasDaConta(clienteId)).toEqual({ ouro: 5000, prata: 1000 })
  })

  it('o dono muda, e a leitura devolve número e não texto', async () => {
    expect((await definirFaixas(clienteId, { ouro: 3000, prata: 500 })).ok).toBe(true)
    const faixas = await faixasDaConta(clienteId)
    expect(faixas).toEqual({ ouro: 3000, prata: 500 })
    // `numeric` volta como string do supabase-js, e comparar "3000" com 500
    // como texto daria ordem alfabética.
    expect(typeof faixas!.ouro).toBe('number')
    await definirFaixas(clienteId, FAIXAS_PADRAO)
  })
})

describe.skipIf(!temCredencial)('o relacionamento em lote', () => {
  it('classifica pelo que cada um gastou, e soma numeric sem concatenar', async () => {
    await vender(ouro, 2500, posVendaId) // total 6500, e não "40002500"

    const mapa = await relacionamentoDeMuitos(clienteId, [ouro, bronze, novato], FAIXAS_PADRAO)

    expect(mapa.get(ouro)!.total).toBe(6500)
    expect(mapa.get(ouro)!.compras).toBe(2)
    expect(mapa.get(ouro)!.nivel).toBe('ouro')
    expect(mapa.get(bronze)!.nivel).toBe('bronze')
    expect(mapa.get(novato)!.nivel).toBe('sem_compra')
  })

  /**
   * O defeito medido da T8.1, e o cenário exato que ele produzia:
   *
   * a clínica tem um quadro "Atendimento" com a coluna "Resolvido". Dez dúvidas
   * respondidas viravam dez compras e uma receita que ninguém faturou, porque a
   * consulta lia `quadro_cartoes` com `situacao = 'ganha'` em **qualquer**
   * quadro. O dono olhava o painel, via um faturamento que não existia, e a
   * partir dali não confiava em mais nenhum número da tela.
   */
  it('cartão ganho sem venda NÃO é compra', async () => {
    const mapa = await relacionamentoDeMuitos(clienteId, [atendido], FAIXAS_PADRAO)
    const r = mapa.get(atendido)!

    expect(r.compras).toBe(0)
    expect(r.total).toBe(0)
    expect(r.nivel).toBe('sem_compra')
    // E a data de compra continua nula: não há compra para datar.
    expect(r.diasDaUltimaCompra).toBeNull()
  })

  /**
   * A outra metade do defeito: `Number(linha.valor ?? 0)`.
   *
   * Quem comprou sem valor informado lia "R$ 0,00" e caía em `sem_compra`, ou
   * seja, a tela afirmava que a pessoa nunca comprou por causa de um campo que
   * ninguém preencheu.
   */
  it('venda sem valor informado é compra, e não vira zero', async () => {
    const mapa = await relacionamentoDeMuitos(clienteId, [semValor], FAIXAS_PADRAO)
    const r = mapa.get(semValor)!

    expect(r.compras).toBe(1)
    expect(r.semValor).toBe(1)
    // O total é o que se **sabe**, e não se sabe nada: zero conhecido.
    expect(r.total).toBe(0)
    // Mas ela comprou, então não é "ainda não comprou".
    expect(r.nivel).toBe('bronze')
    expect(r.diasDaUltimaCompra).toBe(0)
  })

  it('venda cancelada sai dos indicadores sem sumir do registro', async () => {
    const cartaoId = await ganharCartao(novato, 700, posVendaId)
    const venda = await registrarVenda({
      clienteId,
      contatoId: novato,
      cartaoId,
      dataDaVenda: new Date().toISOString().slice(0, 10),
      valorTotal: 700,
    })
    expect(venda.ok).toBe(true)

    const antes = await relacionamentoDeMuitos(clienteId, [novato], FAIXAS_PADRAO)
    expect(antes.get(novato)!.compras).toBe(1)

    const { cancelarVenda } = await import('./vendas')
    expect((await cancelarVenda(clienteId, venda.ok ? venda.venda.id : '', 'teste')).ok).toBe(true)

    const depois = await relacionamentoDeMuitos(clienteId, [novato], FAIXAS_PADRAO)
    expect(depois.get(novato)!.compras).toBe(0)
    expect(depois.get(novato)!.nivel).toBe('sem_compra')
  })

  it('quem nunca comprou entra no mapa com zeros, e não sai de fora', async () => {
    // Um `undefined` aqui vira "cannot read property" na tela de quem desenha a
    // linha sem conferir se a pessoa está no mapa.
    const desconhecido = (await acharOuCriarContato(clienteId, `5511${seed}09`, 'Ninguém')).id
    const mapa = await relacionamentoDeMuitos(clienteId, [desconhecido], FAIXAS_PADRAO)
    expect(mapa.get(desconhecido)).toBeDefined()
    expect(mapa.get(desconhecido)!.total).toBe(0)
    expect(mapa.get(desconhecido)!.semValor).toBe(0)
    expect(mapa.get(desconhecido)!.recencia).toBe('sem_contato')
  })

  it('a recência é da conversa, não da compra', async () => {
    await falouHaDias(ouro, 120)
    const mapa = await relacionamentoDeMuitos(clienteId, [ouro], FAIXAS_PADRAO)

    // Comprou agora mesmo, mas não fala há quatro meses: está indo embora.
    expect(mapa.get(ouro)!.nivel).toBe('ouro')
    expect(mapa.get(ouro)!.recencia).toBe('sumido')
    expect(mapa.get(ouro)!.diasDaUltimaCompra).toBe(0)
  })
})

describe.skipIf(!temCredencial)('quem entra na régua de retomada', () => {
  it('pega cliente calado e ignora quem nunca comprou', async () => {
    await falouHaDias(ouro, 120)
    await falouHaDias(novato, 200) // sumido, mas a venda dele foi cancelada

    const sumidos = await clientesSumidos(clienteId, 90)
    const ids = sumidos.map((s) => s.contatoId)

    expect(ids).toContain(ouro)
    // Correr atrás de desconhecido que sumiu é encher a fila de trabalho que
    // ninguém faz.
    expect(ids).not.toContain(novato)
  })

  /**
   * A RB-32 na régua: o quadro de atendimento não produz cliente.
   *
   * Sem esta separação, a conta que usa um quadro para triagem manda régua de
   * retomada ("faz tempo que a gente não se fala") para todo mundo que teve uma
   * dúvida resolvida e nunca comprou nada.
   */
  it('cartão ganho sem venda não entra na régua', async () => {
    await falouHaDias(atendido, 200)
    const sumidos = await clientesSumidos(clienteId, 90)
    expect(sumidos.map((s) => s.contatoId)).not.toContain(atendido)
  })

  it('ignora quem comprou e nunca trocou mensagem', async () => {
    // Contato importado ou lançado à mão: a régua de retomada seria a primeira
    // mensagem que ele recebe da conta, dizendo "faz tempo que não se falam".
    const sumidos = await clientesSumidos(clienteId, 90)
    expect(sumidos.map((s) => s.contatoId)).not.toContain(importado)
  })

  it('não pega quem ainda está falando', async () => {
    await falouHaDias(bronze, 3)
    const sumidos = await clientesSumidos(clienteId, 90)
    expect(sumidos.map((s) => s.contatoId)).not.toContain(bronze)
  })

  it('devolve o total conhecido e quantas compras estão sem valor', async () => {
    await falouHaDias(semValor, 200)
    const sumidos = await clientesSumidos(clienteId, 90)
    const linha = sumidos.find((s) => s.contatoId === semValor)

    // Ela comprou, então entra na régua: o que falta é o valor, não a compra.
    expect(linha).toBeDefined()
    expect(linha!.total).toBe(0)
    expect(linha!.semValor).toBe(1)
    // E a data da compra é conhecida, senão ela não poderia estar aqui (RB-35).
    expect(linha!.ultimaCompraEm).not.toBeNull()
  })
})
