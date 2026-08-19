import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canalMock } from '@/channels/mock'
import { fluxoNovo } from '@/core/flow/novo'
import type { Fluxo } from '@/core/flow/schema'
import { db } from './db'
import { receberMensagem, rodarPosAtendimento } from './receber-mensagem'
import { criarCliente } from './repos/clientes'
import {
  criarCanal,
  definirFluxosDoNumero,
  encerrarAtendimento,
  ultimaSessao,
} from './repos/conversas'
import { criarFluxo, publicar } from './repos/fluxos'
import { criarGatilho, listarGatilhos } from './repos/gatilhos'
import { acharLead } from './repos/leads'

/**
 * A6 — os quatro papéis do número e as palavras-chave, do webhook até o canal.
 *
 * O que está sendo provado aqui é **qual fluxo abre**, que é a única coisa que
 * a A6 mudou. Nada disso aparece como erro quando erra: a conversa responde,
 * responde bonito, e responde a coisa errada — quem escreveu "cancelar" ouve a
 * saudação da triagem e vai embora achando que o bot não entendeu.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-a6-${Math.random().toString(36).slice(2, 8)}`

const mock = canalMock()
const comMock = () => mock

const numeroDoBot = `test-a6-${Math.random().toString(36).slice(2, 10)}`
const seedTelefone = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')
const telefone = (indice: number) => `5511${seedTelefone}${indice.toString().padStart(2, '0')}`

/** Cada papel abre com uma frase diferente. É como o teste sabe quem falou. */
const FRASE = {
  principal: 'aqui fala o PRINCIPAL',
  boasVindas: 'aqui fala o BOAS-VINDAS',
  midia: 'aqui fala o MIDIA',
  posAtendimento: 'aqui fala o POS-ATENDIMENTO',
  gatilho: 'aqui fala o GATILHO',
} as const

/**
 * O esqueleto que todo fluxo novo já é, com a primeira frase trocada.
 *
 * Ele para numa pergunta depois de falar, e não num handoff: uma conversa em
 * `humano` calaria o bot e os testes seguintes não teriam o que observar. A
 * saída para humano existe porque `publicar()` recusa fluxo sem ela.
 */
function fluxoQueDiz(texto: string): Fluxo {
  const fluxo = fluxoNovo()
  const abertura = fluxo.nodes.find((no) => no.id === 'abertura')
  if (abertura?.type !== 'mensagem') throw new Error('o fluxo novo deveria começar com mensagem')
  abertura.data = { partes: [{ tipo: 'texto', texto }] }
  return fluxo
}

async function publicarFluxo(clienteId: string, nome: string, texto: string): Promise<string> {
  const grafo = fluxoQueDiz(texto)
  const fluxo = await criarFluxo(clienteId, `${marca} ${nome}`, grafo)
  const publicado = await publicar(fluxo.id, clienteId, grafo)
  if (!publicado.ok) throw new Error(`o fluxo ${nome} deveria publicar`)
  return fluxo.id
}

function webhookTexto(de: string, texto: string, id: string) {
  return {
    entry: [
      {
        changes: [
          {
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
              contacts: [{ wa_id: de }],
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

/** O texto que saiu, na ordem. É o que prova qual fluxo respondeu. */
const textosEnviados = () =>
  mock.enviadas.filter((e) => e.tipo === 'texto').map((e) => (e as { texto: string }).texto)

let clienteId = ''
let canalId = ''
let fluxoDoGatilhoId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const [principal, boasVindas, midia, posAtendimento, doGatilho] = await Promise.all([
    publicarFluxo(clienteId, 'principal', FRASE.principal),
    publicarFluxo(clienteId, 'boas-vindas', FRASE.boasVindas),
    publicarFluxo(clienteId, 'midia', FRASE.midia),
    publicarFluxo(clienteId, 'pos', FRASE.posAtendimento),
    publicarFluxo(clienteId, 'gatilho', FRASE.gatilho),
  ])
  fluxoDoGatilhoId = doGatilho

  const canal = await criarCanal({ clienteId, phoneNumberId: numeroDoBot, flowId: principal })
  canalId = canal.id

  const papeis = await definirFluxosDoNumero(clienteId, canalId, {
    principal,
    boasVindas,
    midia,
    posAtendimento,
  })
  if (!papeis.ok) throw new Error(`os papéis deveriam entrar: ${papeis.motivo}`)

  const gatilho = await criarGatilho(clienteId, {
    frase: 'cancelar',
    operador: 'contem',
    fluxoId: doGatilho,
  })
  if (!gatilho.ok) throw new Error(`o gatilho deveria entrar: ${gatilho.motivo}`)
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('os quatro papéis do número', () => {
  it('a primeira conversa é a de boas-vindas, e a segunda é a principal', async () => {
    const de = telefone(1)

    mock.enviadas.length = 0
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-bv-1`), comMock)
    expect(textosEnviados()[0]).toBe(FRASE.boasVindas)

    // Fecha a conversa pela opção que despede, para a próxima mensagem abrir
    // uma nova — é o que faz "primeira vez" deixar de ser verdade.
    await receberMensagem(webhookBotao(de, 'depois', `wamid-${marca}-bv-2`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookTexto(de, 'voltei', `wamid-${marca}-bv-3`), comMock)
    expect(textosEnviados()[0]).toBe(FRASE.principal)
  })

  it('áudio roda o fluxo de mídia em vez de acordar alguém (o fim da Regra B)', async () => {
    const de = telefone(2)

    mock.enviadas.length = 0
    await receberMensagem(webhookAudio(de, `wamid-${marca}-audio-1`), comMock)

    expect(textosEnviados()[0]).toBe(FRASE.midia)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const lead = await acharLead(clienteId, contato!.id as string)
    // O ponto inteiro da mudança: ninguém foi chamado.
    expect(lead?.aguardando).toBeNull()
  })

  it('áudio no meio de uma conversa também vai para o fluxo de mídia', async () => {
    const de = telefone(3)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-audio-2a`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookAudio(de, `wamid-${marca}-audio-2b`), comMock)

    expect(textosEnviados()[0]).toBe(FRASE.midia)
  })
})

describe.skipIf(!temCredencial)('as palavras-chave', () => {
  it('abrem o fluxo delas interrompendo a conversa em andamento, e contam o disparo', async () => {
    const de = telefone(4)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-gat-1`), comMock)

    const antes = (await listarGatilhos(clienteId)).find((g) => g.frase === 'cancelar')!.execucoes

    mock.enviadas.length = 0
    await receberMensagem(
      webhookTexto(de, 'na verdade quero cancelar meu plano', `wamid-${marca}-gat-2`),
      comMock,
    )

    expect(textosEnviados()[0]).toBe(FRASE.gatilho)

    const depois = (await listarGatilhos(clienteId)).find((g) => g.frase === 'cancelar')!.execucoes
    expect(depois).toBe(antes + 1)

    // A conversa antiga não pode ficar viva para trás: duas sessões abertas no
    // mesmo número fariam a próxima leitura escolher no escuro.
    const viva = await ultimaSessao(
      ((await db().from('contacts').select('id').eq('wa_id', de).single()).data!.id as string),
      canalId,
    )
    expect(viva?.sessao.status).toBe('ativa')
  })

  it('não atropelam quem pediu para falar com uma pessoa', async () => {
    const de = telefone(5)
    // "falar" está dentro de "quero falar com uma pessoa", que é escape global.
    // Sem a ordem certa, o gatilho do cliente engoliria o pedido.
    const gatilho = await criarGatilho(clienteId, {
      frase: 'falar',
      operador: 'contem',
      fluxoId: fluxoDoGatilhoId,
    })
    expect(gatilho.ok).toBe(true)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-esc-1`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(
      webhookTexto(de, 'quero falar com uma pessoa', `wamid-${marca}-esc-2`),
      comMock,
    )

    expect(textosEnviados()[0]).not.toBe(FRASE.gatilho)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const lead = await acharLead(clienteId, contato!.id as string)
    expect(lead?.aguardando?.motivo).toContain('pediu para falar')
  })

  it('não são disparadas por clique em botão', async () => {
    const de = telefone(6)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-btn-1`), comMock)

    mock.enviadas.length = 0
    // O rótulo do botão não é o que chega: chega o id da opção. Mesmo assim, a
    // regra é explícita — clique nunca é sequestrado por palavra-chave.
    await receberMensagem(webhookBotao(de, 'falar', `wamid-${marca}-btn-2`), comMock)

    expect(textosEnviados()[0]).not.toBe(FRASE.gatilho)
  })

  it('recusam fluxo de outro cliente e frase repetida', async () => {
    const outro = await criarCliente(`${marca} outro`)
    try {
      const doOutro = await publicarFluxo(outro.id, 'alheio', 'não é para cá')

      const alheio = await criarGatilho(clienteId, {
        frase: 'tanto faz',
        operador: 'igual',
        fluxoId: doOutro,
      })
      expect(alheio).toEqual({ ok: false, motivo: 'este fluxo não é deste cliente' })

      const repetida = await criarGatilho(clienteId, {
        frase: '  CANCELAR ',
        operador: 'contem',
        fluxoId: fluxoDoGatilhoId,
      })
      expect(repetida.ok).toBe(false)
    } finally {
      await db().from('clients').delete().eq('id', outro.id)
    }
  })
})

describe.skipIf(!temCredencial)('o pós-atendimento', () => {
  it('fala depois do "Já atendi", e só quando a janela de 24h está aberta', async () => {
    const de = telefone(7)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-pos-1`), comMock)
    await receberMensagem(webhookBotao(de, 'falar', `wamid-${marca}-pos-2`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string
    expect((await acharLead(clienteId, contatoId))?.aguardando).not.toBeNull()

    await encerrarAtendimento(clienteId, contatoId)

    mock.enviadas.length = 0
    await rodarPosAtendimento(clienteId, contatoId, comMock)
    expect(textosEnviados()[0]).toBe(FRASE.posAtendimento)
  })

  it('cala fora da janela de 24h em vez de virar handoff logo depois de fechar', async () => {
    const de = telefone(8)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-pos-3`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string

    // Envelhece a entrada: é o único jeito de exercitar a janela fechada sem
    // esperar um dia. O que o WhatsApp recusaria de verdade é o envio, e aí a
    // falha viraria um handoff em cima de uma conversa recém-resolvida.
    const trintaHorasAtras = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    await db()
      .from('messages')
      .update({ ts: trintaHorasAtras })
      .eq('contact_id', contatoId)
      .eq('direcao', 'entrada')

    await encerrarAtendimento(clienteId, contatoId)

    mock.enviadas.length = 0
    await rodarPosAtendimento(clienteId, contatoId, comMock)
    expect(mock.enviadas).toEqual([])
  })

  it('não fala com quem está com o bot pausado', async () => {
    const de = telefone(9)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-pos-4`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string

    await db().from('contacts').update({ automacao_ativa: false }).eq('id', contatoId)
    await encerrarAtendimento(clienteId, contatoId)

    mock.enviadas.length = 0
    await rodarPosAtendimento(clienteId, contatoId, comMock)
    expect(mock.enviadas).toEqual([])
  })
})
