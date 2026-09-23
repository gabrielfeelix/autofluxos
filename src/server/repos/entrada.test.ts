import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { db } from '../db'
import { criarCampanha } from './campanhas'
import { criarCliente } from './clientes'
import { destinoPodeReceber, recusaParaLigar } from './entrada'
import { criarFluxo, publicar } from './fluxos'
import { criarGatilho } from './gatilhos'
import { criarGatilhoDeEvento } from './webhooks-de-entrada'

/**
 * Nada liga apontando para rascunho (A05), contra o banco de verdade.
 *
 * As ações dependem de sessão, então o teste é das funções que elas chamam:
 * `recusaParaLigar` (o que as três entradas perguntam antes de ligar) e a
 * criação, que nasce desligada quando o destino ainda não foi publicado.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-entrada-${Math.random().toString(36).slice(2, 8)}`

function desenho(texto: string): Fluxo {
  return fluxoSchema.parse({
    inicio: 'oi',
    nodes: [
      { id: 'oi', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto } },
      { id: 'h', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [{ id: 'e1', source: 'oi', target: 'h' }],
  })
}

let clienteId = ''
let rascunhoId = ''
let publicadoId = ''

async function idDaPalavra(frase: string) {
  const { data } = await db()
    .from('gatilhos')
    .select('id, ativo')
    .eq('client_id', clienteId)
    .eq('frase', frase)
    .single()
  return data as { id: string; ativo: boolean }
}

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
  const [rascunho, publicado] = await Promise.all([
    criarFluxo(clienteId, `${marca} rascunho`, desenho('Olá!')),
    criarFluxo(clienteId, `${marca} publicado`, desenho('Olá!')),
  ])
  rascunhoId = rascunho.id
  publicadoId = publicado.id
  const r = await publicar(publicadoId, clienteId, desenho('Bom dia! Como posso ajudar?'))
  if (!r.ok) throw new Error('não publicou o fluxo do teste')
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('ligar uma entrada', () => {
  it('destinoPodeReceber diz se o fluxo existe e está publicado', async () => {
    expect(await destinoPodeReceber(clienteId, rascunhoId)).toEqual({ existe: true, publicado: false })
    expect(await destinoPodeReceber(clienteId, publicadoId)).toEqual({ existe: true, publicado: true })
    const outra = await criarCliente(`${marca} outra`)
    try {
      // Fluxo de outra conta é, para esta, um fluxo que não existe.
      expect(await destinoPodeReceber(outra.id, publicadoId)).toEqual({
        existe: false,
        publicado: false,
      })
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })

  it('criar para rascunho nasce desligado', async () => {
    await criarGatilho(clienteId, { frase: 'rascunho', operador: 'contem', fluxoId: rascunhoId })
    expect((await idDaPalavra('rascunho')).ativo).toBe(false)

    const evento = await criarGatilhoDeEvento(clienteId, `${marca}-evento`, rascunhoId)
    if (!evento.ok) throw new Error(evento.motivo)
    const { data: linhaDoEvento } = await db()
      .from('gatilhos_de_evento')
      .select('ativo')
      .eq('id', evento.id)
      .single()
    expect(linhaDoEvento?.ativo).toBe(false)

    await criarCampanha(clienteId, { nome: 'anúncio', frase: `${marca} frase`, fluxoId: rascunhoId })
    const { data: campanha } = await db()
      .from('campanhas')
      .select('ativa')
      .eq('client_id', clienteId)
      .single()
    expect(campanha?.ativa).toBe(false)
  })

  it('criar para publicado nasce ligado', async () => {
    await criarGatilho(clienteId, { frase: 'publicado', operador: 'contem', fluxoId: publicadoId })
    expect((await idDaPalavra('publicado')).ativo).toBe(true)
  })

  it('ligar palavra-chave para fluxo em rascunho é recusado com motivo', async () => {
    const { id } = await idDaPalavra('rascunho')
    expect(await recusaParaLigar('gatilhos', clienteId, id)).toMatch(/Publique antes de ligar/)
  })

  it('ligar para fluxo publicado funciona', async () => {
    const { id } = await idDaPalavra('publicado')
    expect(await recusaParaLigar('gatilhos', clienteId, id)).toBeNull()
  })

  it('entrada de outra conta não vaza motivo', async () => {
    const { id } = await idDaPalavra('rascunho')
    const outra = await criarCliente(`${marca} outra2`)
    try {
      expect(await recusaParaLigar('gatilhos', outra.id, id)).toBeNull()
    } finally {
      await db().from('clients').delete().eq('id', outra.id)
    }
  })
})
