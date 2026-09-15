import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato, registrarEntrada } from './conversas'
import { pulsoDaConta } from './leads'

/**
 * O pulso é o que faz o Inbox se atualizar sozinho.
 *
 * O que não pode falhar aqui é o **isolamento**: `messages` não guarda o
 * cliente, e o vínculo passa por `contacts`. Um erro nesse join faria o Inbox
 * de uma conta piscar por causa do movimento de outra — e, pior, revelaria que
 * a outra conta tem movimento.
 */
const temTudo = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)

const marca = `zz-pulso-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteA = ''
let clienteB = ''
let contatoA = ''

beforeAll(async () => {
  if (!temTudo) return
  clienteA = (await criarCliente(`${marca} A`)).id
  clienteB = (await criarCliente(`${marca} B`)).id
  contatoA = (await acharOuCriarContato(clienteA, `5511${seed}01`, 'Ana')).id
})

afterAll(async () => {
  if (!temTudo) return
  for (const id of [clienteA, clienteB]) if (id) await db().from('clients').delete().eq('id', id)
})

describe.skipIf(!temTudo)('pulso da conta', () => {
  it('conta sem mensagem nenhuma devolve null, e não erro', async () => {
    expect(await pulsoDaConta(clienteB)).toBeNull()
  })

  it('depois da primeira mensagem, devolve o carimbo dela', async () => {
    await registrarEntrada({
      contatoId: contatoA,
      sessaoId: null,
      texto: 'oi',
      waMessageId: `wamid.${marca}.1`,
      payload: {},
    })

    const pulso = await pulsoDaConta(clienteA)
    expect(pulso).not.toBeNull()
    /*
     * O pulso é **opaco**: carimbo, uma barra, e um dígito por mensagem do fim
     * da conversa dizendo se ela já tem arquivo guardado. Quem compara só
     * pergunta se mudou. O teste confere o formato justamente para ninguém
     * voltar a tratá-lo como data — ele já foi uma, e voltar a ser quebraria o
     * conserto do arquivo que chega atrasado.
     */
    expect(pulso).toMatch(/^.+\|[01]+$/)
    expect(Number.isNaN(Date.parse((pulso as string).split('|')[0] as string))).toBe(false)
  })

  it('mensagem nova muda o pulso — é isso que dispara o refresh', async () => {
    const antes = await pulsoDaConta(clienteA)

    await registrarEntrada({
      contatoId: contatoA,
      sessaoId: null,
      texto: 'e aí',
      waMessageId: `wamid.${marca}.2`,
      payload: {},
    })

    expect(await pulsoDaConta(clienteA)).not.toBe(antes)
  })

  /**
   * O defeito que este teste tranca: o GIF animado que nunca aparecia.
   *
   * A mensagem é gravada primeiro e a mídia baixa depois. Enquanto o pulso era
   * só `max(ts)`, a chegada do arquivo não mudava nada — e a tela que se
   * atualizou no meio do caminho ficava para sempre dizendo "sem cópia
   * guardada" para um arquivo que estava no bucket.
   */
  it('arquivo que chega depois da mensagem muda o pulso', async () => {
    const antes = await pulsoDaConta(clienteA)

    await db()
      .from('messages')
      .update({
        arquivo: {
          midia: 'imagem',
          caminho: `${marca}/fingido.webp`,
          mime: 'image/webp',
          bytes: 1234,
        },
      })
      .eq('wa_message_id', `wamid.${marca}.2`)

    expect(await pulsoDaConta(clienteA)).not.toBe(antes)
  })

  it('o movimento de uma conta NÃO aparece na outra', async () => {
    // A conta A acabou de receber duas mensagens; a B continua sem nenhuma.
    expect(await pulsoDaConta(clienteA)).not.toBeNull()
    expect(await pulsoDaConta(clienteB)).toBeNull()
  })
})
