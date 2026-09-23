import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import {
  criarTransmissao,
  enfileirarDestinatarios,
  enviadasHojePelaConta,
  mudarEstadoDaTransmissao,
  progressoDa,
  progressoDas,
} from './transmissoes'

/**
 * O consumo do dia (tarefa 6.1) e o progresso agregado (tarefa 6.2).
 *
 * O consumo é o número que a prévia de "Nova transmissão" usa para dizer
 * "cabem 70 hoje". Errado para baixo, a campanha passa do limite e a Meta
 * recusa o excedente; errado para cima, a tela barra quem cabia.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-tdd-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, '0')

// Meio-dia em Brasília: longe da virada, qualquer que seja o fuso da máquina.
const AGORA = new Date('2026-09-23T15:00:00Z')
const ONTEM = new Date('2026-09-22T15:00:00Z').toISOString()
const HOJE_CEDO = new Date('2026-09-23T11:00:00Z').toISOString()
const AMANHA = new Date('2026-09-24T15:00:00Z').toISOString()

let clienteId = ''
let templateId = ''
const contatos: string[] = []

async function transmissao(nome: string, quantos: number, quando: string | null = null) {
  const t = await criarTransmissao({ clienteId, nome: `${marca} ${nome}`, templateId, quando })
  await enfileirarDestinatarios(t.id, contatos.slice(0, quantos))
  return t
}

async function marcarSaida(transmissaoId: string, quantos: number, em: string, estado = 'entregue') {
  const { data } = await db()
    .from('transmissao_destinatarios')
    .select('id')
    .eq('transmissao_id', transmissaoId)
    .limit(quantos)
  const ids = ((data ?? []) as { id: string }[]).map((l) => l.id)
  const { error } = await db()
    .from('transmissao_destinatarios')
    .update({ estado, enviada_em: em })
    .in('id', ids)
  if (error) throw new Error(error.message)
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  for (let i = 0; i < 6; i++) {
    contatos.push((await acharOuCriarContato(clienteId, `55${seed}00${i}1`, `C${i}`)).id)
  }
  const { data, error } = await db()
    .from('templates')
    .insert({
      cliente_id: clienteId,
      nome: `${marca.replace(/-/g, '_')}_modelo`,
      categoria: 'MARKETING',
      status: 'aprovado',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  templateId = (data as { id: string }).id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) {
    await db().from('transmissoes').delete().eq('cliente_id', clienteId)
    await db().from('clients').delete().eq('id', clienteId)
  }
})

describe.skipIf(!temCredencial)('quanto do limite de hoje já foi gasto', () => {
  it('conta as de hoje e ignora as de ontem e as canceladas antes de sair', async () => {
    // Saiu ontem: 4 destinatários, não conta.
    const deOntem = await transmissao('ontem', 4)
    await marcarSaida(deOntem.id, 4, ONTEM)
    await mudarEstadoDaTransmissao(deOntem.id, 'concluida')

    // Saiu hoje cedo: 3, contam (inclusive a retida).
    const deHoje = await transmissao('hoje', 3)
    await marcarSaida(deHoje.id, 2, HOJE_CEDO)
    await marcarSaida(deHoje.id, 3, HOJE_CEDO, 'retida')
    await mudarEstadoDaTransmissao(deHoje.id, 'concluida')

    // Cancelada antes de sair: 5 na fila, nunca vão gastar nada.
    const cancelada = await transmissao('cancelada', 5)
    await mudarEstadoDaTransmissao(cancelada.id, 'cancelada')

    // Agendada para amanhã: não pesa hoje.
    const amanha = await transmissao('amanhã', 6, AMANHA)
    await mudarEstadoDaTransmissao(amanha.id, 'agendada')

    expect(await enviadasHojePelaConta(clienteId, AGORA)).toBe(3)

    // Agendada para agora: os 2 da fila disputam o mesmo limite de hoje.
    const agora = await transmissao('agora', 2)
    await mudarEstadoDaTransmissao(agora.id, 'agendada')

    expect(await enviadasHojePelaConta(clienteId, AGORA)).toBe(5)
  })

  it('não conta a transmissão de outra conta', async () => {
    const outra = await criarCliente(`${marca} outra`)
    try {
      expect(await enviadasHojePelaConta(outra.id, AGORA)).toBe(0)
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })
})

describe.skipIf(!temCredencial)('o progresso da lista numa consulta só', () => {
  it('dá o mesmo resultado que a leitura por transmissão', async () => {
    const a = await transmissao('p1', 6)
    await marcarSaida(a.id, 2, HOJE_CEDO)
    const b = await transmissao('p2', 3)
    await marcarSaida(b.id, 3, HOJE_CEDO, 'falhou')
    const c = await transmissao('p3', 1)

    const juntos = await progressoDas([a.id, b.id, c.id])
    for (const t of [a, b, c]) {
      expect(juntos.get(t.id)).toEqual(await progressoDa(t.id))
    }
    expect(juntos.get(a.id)).toMatchObject({ entregue: 2, na_fila: 4, total: 6 })
    expect(juntos.get(b.id)).toMatchObject({ falhou: 3, total: 3 })
  })

  it('devolve zerado para transmissão sem destinatário e para lista vazia', async () => {
    const vazia = await criarTransmissao({ clienteId, nome: `${marca} vazia`, templateId })
    expect((await progressoDas([vazia.id])).get(vazia.id)?.total).toBe(0)
    expect((await progressoDas([])).size).toBe(0)
  })
})
