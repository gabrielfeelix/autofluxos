import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { criarConexao, listarConexoes, marcarTeste, trocarValor } from './conexoes'

/**
 * O último teste de uma chave (0097, tarefa 6.7), contra o banco de verdade:
 * gravar o resultado, não alcançar chave de outra conta, e trocar o segredo
 * volta a chave para "nunca testada".
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-chave-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let outroId = ''

beforeAll(async () => {
  if (!temCredencial) return
  const [cliente, outro] = await Promise.all([criarCliente(`${marca} cliente`), criarCliente(`${marca} outro`)])
  clienteId = cliente.id
  outroId = outro.id
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
  if (outroId) await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('teste da chave', () => {
  it('nasce nunca testada, grava o teste e a troca de segredo apaga', async () => {
    const chave = await criarConexao({ clienteId, nome: 'Agenda', tipo: 'bearer', valor: 'um' })
    expect(chave).toMatchObject({ testadaEm: null, testeOk: null })

    await marcarTeste(chave.id, clienteId, false)
    let lida = (await listarConexoes(clienteId)).find((c) => c.id === chave.id)!
    expect(lida.testeOk).toBe(false)
    expect(lida.testadaEm).not.toBeNull()

    // Pela conta errada não grava nada.
    await marcarTeste(chave.id, outroId, true)
    lida = (await listarConexoes(clienteId)).find((c) => c.id === chave.id)!
    expect(lida.testeOk).toBe(false)

    await trocarValor(chave.id, clienteId, 'dois')
    lida = (await listarConexoes(clienteId)).find((c) => c.id === chave.id)!
    expect(lida).toMatchObject({ testadaEm: null, testeOk: null })
  })
})
