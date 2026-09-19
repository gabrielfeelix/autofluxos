import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FAIXAS_PADRAO } from '@/core/relacionamento'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { criarQuadro, fecharCartao, listarCartoes, porNoQuadro } from './quadros'
import {
  clientesSumidos,
  definirFaixas,
  faixasDaConta,
  relacionamentoDeMuitos,
} from './relacionamento'

/**
 * O relacionamento contra o banco de verdade (0070).
 *
 * O que só aparece aqui, e não no teste puro de `core/relacionamento.ts`: a soma
 * de `numeric` em lote — que o supabase-js entrega como string, e que somada sem
 * converter concatena — e a regra de quem entra na régua de retomada.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-rel-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let ouro = ''
let bronze = ''
let novato = ''
let importado = ''
let quadroId = ''
let posVendaId = ''

/** Mexe o relógio da pessoa para trás, que é o que o teste de recência precisa. */
async function falouHaDias(contatoId: string, dias: number) {
  await db()
    .from('contacts')
    .update({ ultima_mensagem_em: new Date(Date.now() - dias * 86_400_000).toISOString() })
    .eq('id', contatoId)
}

/**
 * Uma venda para esta pessoa, no quadro pedido.
 *
 * O quadro é parâmetro porque **é um cartão por pessoa em cada quadro**
 * (`quadro_cartoes_unico_idx`, 0032): a segunda compra do mesmo cliente não é
 * outro cartão no mesmo funil, é um cartão no funil seguinte — que é exatamente
 * o desenho dos funis encadeados da 0058.
 */
async function vender(contatoId: string, valor: number, emQuadro = quadroId) {
  await porNoQuadro(clienteId, emQuadro, [contatoId])
  const cartao = (await listarCartoes(clienteId, emQuadro)).find((c) => c.contatoId === contatoId)!
  await fecharCartao(clienteId, cartao.id, 'ganha', { valor, motivo: null, titulo: 'Plano' })
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const quadro = await criarQuadro(clienteId, `${marca} vendas`)
  if (quadro.ok) quadroId = quadro.id
  const posVenda = await criarQuadro(clienteId, `${marca} pós-venda`)
  if (posVenda.ok) posVendaId = posVenda.id

  ouro = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ouro')).id
  bronze = (await acharOuCriarContato(clienteId, `5511${seed}02`, 'Bronze')).id
  novato = (await acharOuCriarContato(clienteId, `5511${seed}03`, 'Novato')).id
  importado = (await acharOuCriarContato(clienteId, `5511${seed}04`, 'Importado')).id

  // Duas compras, para provar que a soma soma em vez de concatenar.
  await vender(ouro, 4000)
  await vender(bronze, 200)
  await vender(importado, 3000)
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

    const mapa = await relacionamentoDeMuitos(
      clienteId,
      [ouro, bronze, novato],
      FAIXAS_PADRAO,
    )

    expect(mapa.get(ouro)!.total).toBe(6500)
    expect(mapa.get(ouro)!.compras).toBe(2)
    expect(mapa.get(ouro)!.nivel).toBe('ouro')
    expect(mapa.get(bronze)!.nivel).toBe('bronze')
    expect(mapa.get(novato)!.nivel).toBe('sem_compra')
  })

  it('quem nunca comprou entra no mapa com zeros, e não sai de fora', async () => {
    // Um `undefined` aqui vira "cannot read property" na tela de quem desenha a
    // linha sem conferir se a pessoa está no mapa.
    const mapa = await relacionamentoDeMuitos(clienteId, [novato], FAIXAS_PADRAO)
    expect(mapa.get(novato)).toBeDefined()
    expect(mapa.get(novato)!.total).toBe(0)
    expect(mapa.get(novato)!.recencia).toBe('sem_contato')
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
    await falouHaDias(novato, 200) // sumido, mas nunca comprou

    const sumidos = await clientesSumidos(clienteId, 90)
    const ids = sumidos.map((s) => s.contatoId)

    expect(ids).toContain(ouro)
    // Correr atrás de desconhecido que sumiu é encher a fila de trabalho que
    // ninguém faz.
    expect(ids).not.toContain(novato)
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
})
