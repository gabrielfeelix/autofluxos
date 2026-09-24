import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, trocarBsuid } from './conversas'

/**
 * A ficha do contato quando o telefone some e volta (usernames do WhatsApp).
 *
 * O caso que importa: cliente antigo, gravado pelo telefone, volta depois de 30
 * dias com nome de usuário e o webhook só traz o BSUID. Tem que cair na mesma
 * ficha, e não abrir uma nova, vazia.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-bsuid-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const bsuid = (n: number) => `BR.${seed}${n}000000000`

let clienteId = ''

beforeAll(async () => {
  if (!temCredencial) return
  clienteId = (await criarCliente(`${marca} cliente`)).id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('contato achado pelo BSUID', () => {
  it('o cliente antigo que volta sem telefone cai na mesma ficha', async () => {
    const telefone = `5511${seed}01`
    const antes = await acharOuCriarContato(clienteId, telefone, 'Ana', { bsuid: bsuid(1) })
    expect(antes.criadoAgora).toBe(true)

    const depois = await acharOuCriarContato(clienteId, bsuid(1), '@ana', {
      bsuid: bsuid(1),
      username: 'ana',
    })
    expect(depois.id).toBe(antes.id)
    expect(depois.criadoAgora).toBe(false)
    // O telefone guardado não volta a ser BSUID.
    expect(depois.waId).toBe(telefone)
  })

  it('o contato só com BSUID ganha o telefone quando ele aparece', async () => {
    const primeiro = await acharOuCriarContato(clienteId, bsuid(2), '@bia', { bsuid: bsuid(2) })
    expect(primeiro.waId).toBe(bsuid(2))

    const telefone = `5511${seed}02`
    const depois = await acharOuCriarContato(clienteId, telefone, 'Bia', { bsuid: bsuid(2) })
    expect(depois.id).toBe(primeiro.id)
    expect(depois.waId).toBe(telefone)
  })

  it('o contato antigo sem BSUID guardado recebe o BSUID', async () => {
    const telefone = `5511${seed}03`
    const velho = await acharOuCriarContato(clienteId, telefone, 'Cris')
    await acharOuCriarContato(clienteId, telefone, 'Cris', { bsuid: bsuid(3) })

    const semTelefone = await acharOuCriarContato(clienteId, bsuid(3), null, { bsuid: bsuid(3) })
    expect(semTelefone.id).toBe(velho.id)
  })

  it('a troca de BSUID leva a ficha junto', async () => {
    const contato = await acharOuCriarContato(clienteId, bsuid(4), null, { bsuid: bsuid(4) })
    await trocarBsuid(clienteId, bsuid(4), bsuid(5), null)

    const depois = await acharOuCriarContato(clienteId, bsuid(5), null, { bsuid: bsuid(5) })
    expect(depois.id).toBe(contato.id)
    expect(depois.waId).toBe(bsuid(5))
  })
})
