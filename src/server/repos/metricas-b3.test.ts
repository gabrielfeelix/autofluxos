import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { medirTempos, serieDiaria } from './metricas'

/**
 * As métricas de tempo e a série diária (0028).
 *
 * O que precisa ser provado é a **honestidade dos números**, não que a consulta
 * roda: mediana e média medindo do handoff (e não da mensagem da pessoa), e dia
 * sem movimento valendo zero em vez de sumir do eixo.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-b3-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''

/** Uma conversa que entrou na fila e foi respondida depois de `minutos`. */
async function filaDe(indice: number, minutos: number | null) {
  const { data: contato } = await db()
    .from('contacts')
    .insert({ client_id: clienteId, wa_id: `5511${seed}${indice.toString().padStart(2, '0')}` })
    .select('id')
    .single()

  const { data: fluxo } = await db()
    .from('flows')
    .insert({ client_id: clienteId, nome: `${marca} f${indice}`, rascunho: { inicio: 'a', nodes: [{ id: 'a', type: 'mensagem', position: { x: 0, y: 0 }, data: { partes: [{ tipo: 'texto', texto: 'oi' }] } }], edges: [] } })
    .select('id')
    .single()

  const { data: versao } = await db()
    .from('flow_versions')
    .insert({ flow_id: fluxo!.id, versao: 1, grafo: { inicio: 'a', nodes: [{ id: 'a', type: 'mensagem', position: { x: 0, y: 0 }, data: { partes: [{ tipo: 'texto', texto: 'oi' }] } }], edges: [] } })
    .select('id')
    .single()

  const { data: canal } = await db()
    .from('channels')
    .insert({ client_id: clienteId, phone_number_id: `test-b3-${marca}-${indice}` })
    .select('id')
    .single()

  const { data: sessao } = await db()
    .from('sessions')
    .insert({ contact_id: contato!.id, channel_id: canal!.id, flow_version_id: versao!.id })
    .select('id')
    .single()

  const entrouEm = new Date()
  await db().from('handoffs').insert({ session_id: sessao!.id, motivo: 'teste', criado_em: entrouEm.toISOString() })

  if (minutos !== null) {
    await db().from('messages').insert({
      contact_id: contato!.id,
      session_id: sessao!.id,
      direcao: 'saida',
      texto: 'respondendo',
      ts: new Date(entrouEm.getTime() + minutos * 60_000).toISOString(),
    })
  }
}

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  // Duas rápidas e uma esquecida. É o caso que separa mediana de média: a
  // esquecida sozinha empurra a média e faz o time parecer lento.
  await filaDe(1, 2)
  await filaDe(2, 4)
  await filaDe(3, 600)
  await filaDe(4, null)
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('métricas de tempo', () => {
  it('a mediana ignora a conversa esquecida que a média não ignora', async () => {
    const tempos = await medirTempos(clienteId)

    expect(tempos.atual.entraramNaFila).toBe(4)
    // Só três foram respondidas; a quarta não pode entrar na conta como zero.
    expect(tempos.atual.responderam).toBe(3)

    // Mediana de 2, 4 e 600 minutos = 4 minutos.
    expect(tempos.atual.medianaAteResponder).toBeGreaterThanOrEqual(230)
    expect(tempos.atual.medianaAteResponder).toBeLessThanOrEqual(250)

    // A média é arrastada pela de 600 — e é por isso que a tela mostra as duas.
    expect(tempos.atual.mediaAteResponder).toBeGreaterThan(
      tempos.atual.medianaAteResponder! * 10,
    )
  })

  it('nada fechado ainda não vira zero — vira ausência', async () => {
    const tempos = await medirTempos(clienteId)
    expect(tempos.atual.fecharam).toBe(0)
    expect(tempos.atual.medianaAteFechar).toBeNull()
  })
})

describe.skipIf(!temCredencial)('série diária', () => {
  it('devolve um ponto por dia, e dia sem movimento vale zero', async () => {
    const serie = await serieDiaria(clienteId, 7)

    expect(serie).toHaveLength(7)
    // Um gráfico que pula os dias mortos comprime o eixo e transforma uma
    // semana parada num degrau.
    expect(serie.every((ponto) => typeof ponto.contatosNovos === 'number')).toBe(true)
    expect(serie[serie.length - 1]?.contatosNovos).toBe(4)
    expect(serie[serie.length - 1]?.foramParaPessoa).toBe(4)
  })
})
