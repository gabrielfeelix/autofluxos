import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { aplicarFato, marcarUltimaMensagem, resumoDoContato } from './crm'
import { linhaDoTempo } from './eventos'
import { listarMotivos } from './motivos-de-perda'
import {
  acharQuadro,
  criarQuadro,
  definirTipoDaEtapa,
  descreverCartao,
  encadearQuadro,
  fecharCartao,
  listarCartoes,
  porNoQuadro,
  reabrirCartao,
} from './quadros'

/**
 * O funil contra o banco de verdade (0058).
 *
 * O que só aparece aqui, e não no teste puro de `core/crm.ts`: a passagem para o
 * quadro seguinte, o estágio mudando a partir do cartão, e o resumo do cliente
 * somando `numeric` — que o supabase-js entrega como string, e que somado sem
 * converter concatena em vez de somar.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-crm-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let ana = ''
let sdrId = ''
let vendasId = ''

async function estagioDe(contatoId: string): Promise<string> {
  const { data } = await db().from('contacts').select('estagio').eq('id', contatoId).maybeSingle()
  return (data as { estagio: string } | null)?.estagio ?? ''
}

async function cartaoDe(quadroId: string, contatoId: string) {
  const cartoes = await listarCartoes(clienteId, quadroId)
  return cartoes.find((c) => c.contatoId === contatoId) ?? null
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const contato = await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana')
  ana = contato.id

  const sdr = await criarQuadro(clienteId, `${marca} captação`)
  if (sdr.ok) sdrId = sdr.id
  const vendas = await criarQuadro(clienteId, `${marca} vendas`)
  if (vendas.ok) vendasId = vendas.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('o estágio segue os fatos', () => {
  it('o contato nasce novo', async () => {
    expect(await estagioDe(ana)).toBe('novo')
  })

  it('qualificar promove, e o fato vira linha do tempo', async () => {
    expect(await aplicarFato(clienteId, ana, 'qualificou')).toBe('qualificado')
    expect(await estagioDe(ana)).toBe('qualificado')

    const eventos = await linhaDoTempo(clienteId, ana)
    expect(eventos.some((e) => e.tipo === 'mudou-de-estagio')).toBe(true)
  })

  it('aplicar o mesmo fato de novo não escreve nada', async () => {
    expect(await aplicarFato(clienteId, ana, 'qualificou')).toBeNull()
  })

  it('a última mensagem fica registrada', async () => {
    const quando = new Date().toISOString()
    await marcarUltimaMensagem(clienteId, ana, quando)

    const { data } = await db()
      .from('contacts')
      .select('ultima_mensagem_em')
      .eq('id', ana)
      .maybeSingle()
    expect((data as { ultima_mensagem_em: string }).ultima_mensagem_em).toBeTruthy()
  })
})

describe.skipIf(!temCredencial)('ganhar, perder e a cadeia de funis', () => {
  it('a etapa ganha papel', async () => {
    const quadro = (await acharQuadro(clienteId, sdrId))!
    const ultima = quadro.etapas.at(-1)!
    expect(await definirTipoDaEtapa(clienteId, sdrId, ultima.id, 'ganho', 5)).toEqual({ ok: true })

    const relido = (await acharQuadro(clienteId, sdrId))!
    expect(relido.etapas.at(-1)!.tipo).toBe('ganho')
    expect(relido.etapas.at(-1)!.limiteDeDias).toBe(5)
  })

  it('ganhar no primeiro funil abre o cartão no seguinte', async () => {
    expect(await encadearQuadro(clienteId, sdrId, vendasId)).toEqual({ ok: true })
    expect((await porNoQuadro(clienteId, sdrId, [ana])).ok).toBe(true)

    const cartao = (await cartaoDe(sdrId, ana))!
    const r = await fecharCartao(clienteId, cartao.id, 'ganha', { valor: 1500, titulo: 'Plano' })
    expect(r.ok).toBe(true)

    // O cartão do SDR **continua lá**, marcado: é como o time vê o próprio
    // resultado no fim do mês.
    expect((await cartaoDe(sdrId, ana))?.situacao).toBe('ganha')
    // E o funil seguinte recebeu a pessoa sozinho.
    expect(await cartaoDe(vendasId, ana)).not.toBeNull()
    expect(await estagioDe(ana)).toBe('cliente')
  })

  it('o resumo soma o que o cliente rendeu', async () => {
    const resumo = await resumoDoContato(clienteId, ana)
    expect(resumo.compras).toBe(1)
    expect(resumo.total).toBe(1500)
  })

  it('perder exige um motivo da lista da conta', async () => {
    const cartao = (await cartaoDe(vendasId, ana))!

    expect((await fecharCartao(clienteId, cartao.id, 'perdida', {})).ok).toBe(false)
    expect((await fecharCartao(clienteId, cartao.id, 'perdida', { motivo: 'achou caro' })).ok).toBe(
      false,
    )

    const motivos = await listarMotivos(clienteId)
    expect(motivos.length).toBeGreaterThan(0)
    expect(
      (await fecharCartao(clienteId, cartao.id, 'perdida', { motivo: motivos[0]!.nome })).ok,
    ).toBe(true)
  })

  it('perder não rebaixa quem já é cliente', async () => {
    expect(await estagioDe(ana)).toBe('cliente')
  })

  it('reabrir devolve o cartão ao trabalho', async () => {
    const cartao = (await cartaoDe(vendasId, ana))!
    expect(await reabrirCartao(clienteId, cartao.id)).toEqual({ ok: true })
    expect((await cartaoDe(vendasId, ana))?.situacao).toBe('aberta')
  })

  it('título e valor ficam no cartão, sem catálogo nenhum', async () => {
    const cartao = (await cartaoDe(vendasId, ana))!
    expect(
      await descreverCartao(clienteId, cartao.id, { titulo: 'Mensalidade', valor: 89.9 }),
    ).toEqual({ ok: true })

    const relido = (await cartaoDe(vendasId, ana))!
    expect(relido.titulo).toBe('Mensalidade')
    expect(relido.valor).toBe(89.9)
  })

  it('recusa o ciclo que o banco não vê', async () => {
    // vendas → captação fecharia captação → vendas → captação.
    const r = await encadearQuadro(clienteId, vendasId, sdrId)
    expect(r.ok).toBe(false)
  })
})
