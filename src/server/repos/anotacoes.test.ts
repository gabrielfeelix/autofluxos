import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { anotacoesDoContato, linhaDoTempo, registrarAnotacao } from './eventos'

/**
 * Anotações da equipe como histórico (tarefa 5.9), contra o Supabase local.
 *
 * O que se prova: cada anotação é uma entrada nova (nada sobrescreve), a lista
 * sai da mais nova para a mais antiga com autor, e a conta de outro cliente não
 * enxerga as anotações de um contato que não é dela.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-anotacoes-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroClienteId = ''
let contatoId = ''

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} conta`)).id
  outroClienteId = (await criarCliente(`${marca} outra`)).id
  contatoId = (await acharOuCriarContato(clienteId, `5511${seed}01`, 'Bia')).id
})

afterAll(async () => {
  if (!temCredencial) return
  for (const id of [clienteId, outroClienteId]) if (id) await db().from('clients').delete().eq('id', id)
})

describe.skipIf(!temCredencial)('anotações da equipe', () => {
  it('anotar duas vezes guarda as duas, da mais nova para a mais antiga, com autor', async () => {
    const primeira = await registrarAnotacao(clienteId, contatoId, 'Prefere de manhã.', 'Ana')
    await new Promise((ok) => setTimeout(ok, 20))
    const segunda = await registrarAnotacao(clienteId, contatoId, 'Ligou de novo, quer o plano anual.', 'Bruno')

    expect(primeira.id).not.toBe(segunda.id)
    const lista = await anotacoesDoContato(clienteId, contatoId)
    expect(lista.map((a) => [a.texto, a.autor])).toEqual([
      ['Ligou de novo, quer o plano anual.', 'Bruno'],
      ['Prefere de manhã.', 'Ana'],
    ])
    expect(lista[0]?.criadoEm).toBe(segunda.criadoEm)
  })

  it('a anotação também aparece na linha do tempo da ficha', async () => {
    const eventos = await linhaDoTempo(clienteId, contatoId)
    expect(eventos.filter((e) => e.tipo === 'nota')).toHaveLength(2)
  })

  it('outra conta não vê as anotações deste contato', async () => {
    expect(await anotacoesDoContato(outroClienteId, contatoId)).toEqual([])
  })
})
