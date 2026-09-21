import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'
import { passadaDeRetomada } from './passada-de-retomada'
import { criarCliente } from './repos/clientes'
import { acharOuCriarContato } from './repos/conversas'
import { criarQuadro, fecharCartao, listarCartoes, porNoQuadro } from './repos/quadros'
import { registrarVenda } from './repos/vendas'

/**
 * A régua de retomada contra o banco de verdade (0070).
 *
 * O que este arquivo existe para provar é **uma coisa só**, e é a que dói caro:
 * a mesma pessoa não pode entrar duas vezes. Quem está sumido hoje continua
 * sumido amanhã, e sem a trava a régua mandaria uma mensagem por dia para um
 * cliente antigo, que é como se perde um número, não um lead.
 *
 * **O fixture mudou na T8.1, e a mudança é o ponto:** antes ele fechava um
 * cartão como ganho e chamava aquilo de compra. Agora registra venda de
 * verdade, porque cartão ganho deixou de contar. O contato `atendido` entrou
 * justamente para provar a diferença.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-ret-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let sumido = ''
let ativo = ''
let atendido = ''
let sequenciaId = ''

async function inscricoesDe(contatoId: string): Promise<number> {
  const { count } = await db()
    .from('sequencia_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contatoId)
  return count ?? 0
}

beforeAll(async () => {
  if (!temCredencial) return

  clienteId = (await criarCliente(`${marca} cliente`)).id
  const quadro = await criarQuadro(clienteId, `${marca} vendas`)
  const quadroId = quadro.ok ? quadro.id : ''

  sumido = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Sumido')).id
  ativo = (await acharOuCriarContato(clienteId, `5511${seed}02`, 'Ativo')).id
  atendido = (await acharOuCriarContato(clienteId, `5511${seed}03`, 'Atendido')).id

  /** Ganha o cartão da pessoa neste quadro, e devolve o id dele. */
  async function ganhar(contato: string, emQuadro: string) {
    await porNoQuadro(clienteId, emQuadro, [contato])
    const cartao = (await listarCartoes(clienteId, emQuadro)).find((c) => c.contatoId === contato)!
    await fecharCartao(clienteId, cartao.id, 'ganha', { valor: 900, motivo: null, titulo: 'Plano' })
    return cartao.id
  }

  // Os dois compraram de verdade: a régua só olha quem já foi cliente, e a
  // partir da T8.1 "cliente" quer dizer venda registrada.
  for (const contato of [sumido, ativo]) {
    const cartaoId = await ganhar(contato, quadroId)
    const venda = await registrarVenda({
      clienteId,
      contatoId: contato,
      cartaoId,
      dataDaVenda: new Date().toISOString().slice(0, 10),
      valorTotal: 900,
    })
    if (!venda.ok) throw new Error(`o fixture não conseguiu vender: ${venda.motivo}`)
  }

  // Este teve a dúvida resolvida no quadro de atendimento, e **não comprou**.
  // Antes da T8.1 ele receberia a régua dizendo "faz tempo que não se falam".
  const atendimento = await criarQuadro(clienteId, `${marca} atendimento`)
  await ganhar(atendido, atendimento.ok ? atendimento.id : '')

  await db()
    .from('contacts')
    .update({ ultima_mensagem_em: new Date(Date.now() - 200 * 86_400_000).toISOString() })
    .in('id', [sumido, atendido])
  await db()
    .from('contacts')
    .update({ ultima_mensagem_em: new Date().toISOString() })
    .eq('id', ativo)

  // Uma régua com um passo: sequência sem passo não inscreve ninguém.
  const { data: fluxo } = await db()
    .from('flows')
    .insert({ client_id: clienteId, nome: `${marca} fluxo`, rascunho: { nodes: [], edges: [] } })
    .select('id')
    .single()

  const { data: seq } = await db()
    .from('sequencias')
    .insert({
      client_id: clienteId,
      nome: `${marca} retomada`,
      evento: 'cliente_sumido',
      dias_sem_conversa: 90,
    })
    .select('id')
    .single()
  sequenciaId = (seq as { id: string }).id

  await db()
    .from('sequencia_passos')
    .insert({
      sequencia_id: sequenciaId,
      atraso_minutos: 60,
      flow_id: (fluxo as { id: string }).id,
    })
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('a passada de retomada', () => {
  it('inscreve o cliente calado e deixa o ativo em paz', async () => {
    const resumo = await passadaDeRetomada()
    expect(resumo.contasOlhadas).toBeGreaterThan(0)

    expect(await inscricoesDe(sumido)).toBe(1)
    expect(await inscricoesDe(ativo)).toBe(0)
  })

  /**
   * A RB-32 na régua, e o cenário que ela evita:
   *
   * a conta usa um quadro para triagem, com a coluna "Resolvido". Sem separar
   * venda de cartão ganho, toda dúvida respondida virava um cliente, e a régua
   * mandava "faz tempo que a gente não se fala" para quem nunca comprou nada.
   */
  it('quem só teve atendimento resolvido não entra na régua', async () => {
    await passadaDeRetomada()
    expect(await inscricoesDe(atendido)).toBe(0)
  })

  /*
   * O teste que justifica a coluna `por_sumico_em`.
   *
   * Sem ela, a segunda passada inscreveria a mesma pessoa de novo, e como o
   * cron roda todo dia, o cliente receberia a régua diariamente até responder
   * ou bloquear.
   */
  it('não inscreve a mesma pessoa de novo no dia seguinte', async () => {
    await passadaDeRetomada()
    await passadaDeRetomada()

    expect(await inscricoesDe(sumido)).toBe(1)
  })

  it('régua desligada não inscreve ninguém', async () => {
    await db().from('sequencia_inscricoes').delete().eq('contact_id', sumido)
    await db().from('sequencias').update({ ativa: false }).eq('id', sequenciaId)

    await passadaDeRetomada()
    expect(await inscricoesDe(sumido)).toBe(0)

    await db().from('sequencias').update({ ativa: true }).eq('id', sequenciaId)
  })
})
