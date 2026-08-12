import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canalMock } from '@/channels/mock'
import { triagem } from '@/exemplos/triagem'
import { db } from './db'
import { receberMensagem } from './receber-mensagem'
import { criarCliente } from './repos/clientes'
import { criarCanal, ultimaSessao } from './repos/conversas'
import { criarFluxo, publicar, salvarRascunho } from './repos/fluxos'

/**
 * O caminho inteiro, do webhook até a resposta, contra o Supabase de verdade.
 * O canal é o mock — o que importa aqui é a orquestração, não a rede da Meta.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-wh-${Math.random().toString(36).slice(2, 8)}`

let clienteId = ''
let fluxoId = ''
let canalId = ''
const numeroDoBot = `test-${Math.random().toString(36).slice(2, 10)}`

const mock = canalMock()
const comMock = () => mock

/** O formato que a Meta manda de verdade. */
function webhookTexto(de: string, texto: string, id: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: numeroDoBot },
              contacts: [{ wa_id: de, profile: { name: 'Ana Teste' } }],
              messages: [{ id, from: de, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  }
}

function webhookBotao(de: string, opcaoId: string, id: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: numeroDoBot },
              contacts: [{ wa_id: de, profile: { name: 'Ana Teste' } }],
              messages: [
                {
                  id,
                  from: de,
                  type: 'interactive',
                  interactive: { button_reply: { id: opcaoId, title: 'clicou' } },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function webhookAudio(de: string, id: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: numeroDoBot },
              contacts: [{ wa_id: de }],
              messages: [{ id, from: de, type: 'audio' }],
            },
          },
        ],
      },
    ],
  }
}

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const fluxo = await criarFluxo(cliente.id, `${marca} triagem`, triagem)
  fluxoId = fluxo.id
  const pub = await publicar(fluxo.id, triagem)
  if (!pub.ok) throw new Error('o fluxo de exemplo deveria publicar')

  const canal = await criarCanal({ clienteId, phoneNumberId: numeroDoBot, flowId: fluxo.id })
  canalId = canal.id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('receber mensagem do WhatsApp', () => {
  it('primeira mensagem começa o fluxo e responde com a saudação e as opções', async () => {
    mock.enviadas.length = 0
    const de = `5511${Date.now().toString().slice(-9)}`

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-1`), comMock)

    expect(mock.enviadas[0]).toMatchObject({ tipo: 'texto', para: de })
    expect(mock.enviadas.find((e) => e.tipo === 'opcoes')).toMatchObject({ formato: 'botoes' })
  })

  it('ignora reenvio da mesma mensagem — senão a conversa anda duas vezes', async () => {
    const de = `5511${(Date.now() + 1).toString().slice(-9)}`
    const idRepetido = `wamid-${marca}-dup`

    await receberMensagem(webhookTexto(de, 'oi', idRepetido), comMock)
    const depoisDaPrimeira = mock.enviadas.length

    await receberMensagem(webhookTexto(de, 'oi', idRepetido), comMock)
    expect(mock.enviadas.length).toBe(depoisDaPrimeira)
  })

  it('clicar num botão avança o fluxo e guarda a resposta no contato', async () => {
    const de = `5511${(Date.now() + 2).toString().slice(-9)}`
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-3a`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookBotao(de, 'casamento', `wamid-${marca}-3b`), comMock)

    expect(mock.enviadas.some((e) => e.tipo === 'texto' && e.texto.includes('Como posso te chamar'))).toBe(true)

    const { data } = await db().from('contacts').select('campos').eq('wa_id', de).single()
    expect((data?.campos as Record<string, string>).tipo).toBe('Casamento')
  })

  it('áudio vai para uma pessoa em vez de "não entendi" (Regra B)', async () => {
    const de = `5511${(Date.now() + 3).toString().slice(-9)}`
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-4a`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookAudio(de, `wamid-${marca}-4b`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const salva = await ultimaSessao(contato!.id as string, canalId)
    expect(salva?.sessao.status).toBe('humano')

    const { data: handoffs } = await db()
      .from('handoffs')
      .select('motivo')
      .eq('session_id', salva!.id)
    expect(handoffs?.[0]?.motivo).toContain('audio')
  })

  it('depois do handoff o bot fica calado', async () => {
    const de = `5511${(Date.now() + 4).toString().slice(-9)}`
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-5a`), comMock)
    await receberMensagem(webhookAudio(de, `wamid-${marca}-5b`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookTexto(de, 'tem alguém aí?', `wamid-${marca}-5c`), comMock)
    expect(mock.enviadas).toEqual([])
  })

  /**
   * A promessa do §5 completa: publicar de novo no meio do dia não move quem já
   * estava conversando para um bloco que não existia quando ela entrou.
   */
  it('a conversa em andamento continua na versão em que começou', async () => {
    const de = `5511${(Date.now() + 5).toString().slice(-9)}`
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-6a`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const antes = await ultimaSessao(contato!.id as string, canalId)

    // publica uma versão nova, bem diferente
    const outro = structuredClone(triagem)
    const abertura = outro.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'FLUXO NOVO'
    await salvarRascunho(fluxoId, outro)
    const pub = await publicar(fluxoId, outro)
    expect(pub.ok).toBe(true)

    mock.enviadas.length = 0
    await receberMensagem(webhookBotao(de, 'empresa', `wamid-${marca}-6b`), comMock)

    const depois = await ultimaSessao(contato!.id as string, canalId)
    expect(depois?.flowVersionId).toBe(antes?.flowVersionId)
    expect(mock.enviadas.some((e) => e.tipo === 'texto' && e.texto.includes('FLUXO NOVO'))).toBe(false)
  })

  it('número desconhecido não faz nada', async () => {
    mock.enviadas.length = 0
    await receberMensagem(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'numero-que-nao-existe' },
                  messages: [{ id: `wamid-${marca}-7`, from: '5511999', type: 'text', text: { body: 'oi' } }],
                },
              },
            ],
          },
        ],
      },
      comMock,
    )
    expect(mock.enviadas).toEqual([])
  })

  it('evento de status (entregue/lido) é ignorado sem quebrar', async () => {
    mock.enviadas.length = 0
    await receberMensagem(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: numeroDoBot },
                  statuses: [{ id: 'wamid-x', status: 'delivered' }],
                },
              },
            ],
          },
        ],
      },
      comMock,
    )
    expect(mock.enviadas).toEqual([])
  })
})
