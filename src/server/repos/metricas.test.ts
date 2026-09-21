import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, criarCanal } from './conversas'
import { criarFluxo, publicar } from './fluxos'
import { contarExecucoesPorFluxo, medirDesfechos, medirFunil } from './metricas'

const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-metricas-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroClienteId = ''
let primeiroFluxoId = ''
let segundoFluxoId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  const outroCliente = await criarCliente(`${marca} outro`)
  clienteId = cliente.id
  outroClienteId = outroCliente.id

  const primeiro = await criarFluxo(cliente.id, `${marca} primeiro`, fluxoNovo())
  const segundo = await criarFluxo(cliente.id, `${marca} segundo`, fluxoNovo())
  const alheio = await criarFluxo(outroCliente.id, `${marca} alheio`, fluxoNovo())
  primeiroFluxoId = primeiro.id
  segundoFluxoId = segundo.id

  const primeiraVersao = await publicar(primeiro.id, cliente.id, primeiro.rascunho)
  const segundaVersao = await publicar(segundo.id, cliente.id, segundo.rascunho)
  const versaoAlheia = await publicar(alheio.id, outroCliente.id, alheio.rascunho)
  if (!primeiraVersao.ok || !segundaVersao.ok || !versaoAlheia.ok) {
    throw new Error('os fluxos das métricas deveriam publicar')
  }

  const primeiroCanal = await criarCanal({
    clienteId: cliente.id,
    phoneNumberId: `${marca}-1`,
    flowId: primeiro.id,
  })
  const segundoCanal = await criarCanal({
    clienteId: cliente.id,
    phoneNumberId: `${marca}-2`,
    flowId: segundo.id,
  })
  const canalAlheio = await criarCanal({
    clienteId: outroCliente.id,
    phoneNumberId: `${marca}-3`,
    flowId: alheio.id,
  })

  const primeiroContato = await acharOuCriarContato(cliente.id, `${marca}-5511`, null)
  const segundoContato = await acharOuCriarContato(cliente.id, `${marca}-5512`, null)
  const contatoAlheio = await acharOuCriarContato(outroCliente.id, `${marca}-5513`, null)

  const sessoes = [
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'encerrada', '2026-08-02'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'encerrada', '2026-08-03'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'humano', '2026-08-04'),
    sessao(segundoContato.id, segundoCanal.id, segundaVersao.versao.id, 'ativa', '2026-08-05'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'encerrada', '2026-08-07'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'encerrada', '2026-07-02'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'humano', '2026-07-03'),
    sessao(primeiroContato.id, primeiroCanal.id, primeiraVersao.versao.id, 'encerrada', '2026-06-03'),
    sessao(segundoContato.id, segundoCanal.id, segundaVersao.versao.id, 'ativa', '2026-09-01T01:00:00Z'),
    sessao(contatoAlheio.id, canalAlheio.id, versaoAlheia.versao.id, 'encerrada', '2026-08-06'),
  ]

  const { data, error } = await db().from('sessions').insert(sessoes).select('id, criado_em')
  if (error) throw new Error(`não deu para montar as métricas: ${error.message}`)

  const encerradaPorHumano = data.find((linha) => linha.criado_em.startsWith('2026-08-07'))
  if (!encerradaPorHumano) throw new Error('faltou a sessão atendida por uma pessoa')

  // A que ainda espera uma pessoa, em agosto: ela é a transferência POR FALHA
  // do fixture, e é o par que prova a separação da T8.2.
  const esperandoPessoa = data.find((linha) => linha.criado_em.startsWith('2026-08-04'))
  if (!esperandoPessoa) throw new Error('faltou a sessão que espera uma pessoa')

  // A de julho fica **sem origem**, de propósito: é o handoff anterior à 0086, e
  // quem lê tem que tratá-lo como falha em vez de estourar ou sumir.
  const antigaSemOrigem = data.find((linha) => linha.criado_em.startsWith('2026-07-03'))
  if (!antigaSemOrigem) throw new Error('faltou a sessão antiga em humano')

  const { error: erroDoHandoff } = await db()
    .from('handoffs')
    .insert([
      {
        session_id: encerradaPorHumano.id,
        motivo: 'uma pessoa assumiu e já encerrou o atendimento',
        origem: 'prevista',
        resolvido_em: '2026-08-07T13:00:00Z',
      },
      {
        session_id: esperandoPessoa.id,
        motivo: 'a integração não chegou a ser executada',
        origem: 'falha',
      },
      { session_id: antigaSemOrigem.id, motivo: 'gravado antes da 0086' },
    ])
  if (erroDoHandoff) throw new Error(`não deu para montar o handoff: ${erroDoHandoff.message}`)
})

afterAll(async () => {
  if (!temCredencial) return
  await db().from('clients').delete().in('id', [clienteId, outroClienteId])
})

describe.skipIf(!temCredencial)('métricas contra o Supabase', () => {
  it('resume o mês atual e mantém o anterior como referência', async () => {
    expect(await medirFunil(clienteId, new Date('2026-08-31T23:30:00-03:00'))).toEqual({
      atual: { conversas: 6, resolvidasPeloBot: 2, esperandoPessoa: 1 },
      anterior: { conversas: 2, resolvidasPeloBot: 1, esperandoPessoa: 1 },
    })
  })

  /**
   * A T8.2 contra o banco: as quatro fatias, e que elas fecham com o total.
   *
   * O fixture de agosto tem 6 conversas, e cada uma existe por um motivo:
   * 2 encerradas sem handoff (o bot sozinho), 1 encerrada depois que alguém
   * assumiu com handoff **previsto**, 1 esperando pessoa por **falha**, e 2
   * ainda acontecendo. Uma das duas em andamento é a de `2026-09-01T01:00:00Z`,
   * que em São Paulo é 31/ago às 22h: o fuso decide o mês, e é por isso que o
   * fixture original a pôs ali.
   *
   * A conta antiga lia isso como "o bot resolveu 2 de 6", 33%. Agora são 2 de 4
   * terminadas, 50%, e as duas transferências aparecem separadas: uma é o
   * desenho funcionando e a outra é conserto.
   */
  it('separa transferência prevista de transferência por falha', async () => {
    const desfechos = await medirDesfechos(clienteId, new Date('2026-08-31T23:30:00-03:00'))

    expect(desfechos.atual).toEqual({ bot: 2, prevista: 1, falha: 1, aberta: 2 })
    // As fatias somam o total: é a propriedade que faz o painel ser conferível.
    const a = desfechos.atual
    expect(a.bot + a.prevista + a.falha + a.aberta).toBe(6)
  })

  it('handoff sem origem, anterior à 0086, conta como atendimento da equipe', async () => {
    // Julho tem 1 encerrada e 1 em humano com handoff sem `origem`. Contá-la
    // como falha era acusar o produto de um defeito que ninguém verificou: na
    // produção metade desses registros diz "a pessoa pediu atendente".
    const desfechos = await medirDesfechos(clienteId, new Date('2026-08-31T23:30:00-03:00'))
    expect(desfechos.anterior).toEqual({ bot: 1, prevista: 1, falha: 0, aberta: 0 })
  })

  it('não mistura clientes', async () => {
    const desfechos = await medirDesfechos(outroClienteId, new Date('2026-08-31T23:30:00-03:00'))
    // O cliente alheio tem uma encerrada em agosto, e só ela.
    expect(desfechos.atual).toEqual({ bot: 1, prevista: 0, falha: 0, aberta: 0 })
  })

  it('conta todas as execuções de cada fluxo sem misturar clientes', async () => {
    const execucoes = await contarExecucoesPorFluxo(clienteId)

    expect(Object.fromEntries(execucoes)).toEqual({
      [primeiroFluxoId]: 7,
      [segundoFluxoId]: 2,
    })
  })
})

function sessao(
  contatoId: string,
  canalId: string,
  versaoId: string,
  status: 'ativa' | 'encerrada' | 'humano',
  dia: string,
) {
  return {
    contact_id: contatoId,
    channel_id: canalId,
    flow_version_id: versaoId,
    no_atual: null,
    vars: {},
    tentativas: 0,
    status,
    criado_em: dia.includes('T') ? dia : `${dia}T12:00:00Z`,
  }
}
