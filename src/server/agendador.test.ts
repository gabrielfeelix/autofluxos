import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canalMock } from '@/channels/mock'
import { fluxoNovo } from '@/core/flow/novo'
import { fluxoSchema, SAIDA_TIMEOUT, type Fluxo } from '@/core/flow/schema'
import { chaveDoTimeout } from '@/core/tarefas'
import { db } from './db'
import { receberMensagem } from './receber-mensagem'
import { criarCliente } from './repos/clientes'
import { criarCanal, ultimaSessao } from './repos/conversas'
import { acharLead } from './repos/leads'
import { criarFluxo, publicar } from './repos/fluxos'
import { rodarTarefas } from './tarefas'

/**
 * O agendador (B1, migration 0026) e o primeiro consumidor dele: o prazo da
 * pergunta.
 *
 * O que precisa ser provado é **quando ele não faz nada**. A tarefa é agendada
 * minutos ou horas antes de rodar, e no meio disso a conversa pode ter andado,
 * sido assumida, ou o bot pode ter sido pausado. Agir sobre um estado que mudou
 * é acordar alguém com uma cobrança sem sentido — e ninguém está olhando quando
 * o agendador erra.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-agd-${Math.random().toString(36).slice(2, 8)}`

const mock = canalMock()
const comMock = () => mock

const numeroDoBot = `test-agd-${Math.random().toString(36).slice(2, 10)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const telefone = (i: number) => `5511${seed}${i.toString().padStart(2, '0')}`

const DESISTIU = 'Ainda por aí? Se preferir, respondo por aqui quando você puder.'

/**
 * Um fluxo que pergunta com prazo e tem a saída "não respondeu" ligada.
 *
 * O esqueleto padrão já traz a pergunta e a saída para humano que `publicar()`
 * exige; aqui só entram o prazo e a aresta de timeout.
 */
function fluxoComPrazo(minutos: number, comSaida: boolean): Fluxo {
  const fluxo = fluxoNovo()
  const pergunta = fluxo.nodes.find((no) => no.id === 'assunto')
  if (pergunta?.type !== 'pergunta') throw new Error('o esqueleto deveria ter a pergunta')
  pergunta.data = { ...pergunta.data, timeoutMinutos: minutos }

  if (comSaida) {
    fluxo.nodes.push({
      id: 'desistiu',
      type: 'mensagem',
      position: { x: 320, y: 320 },
      data: { partes: [{ tipo: 'texto', texto: DESISTIU }] },
    })
    fluxo.edges.push({
      id: 'a-timeout',
      source: 'assunto',
      sourceHandle: SAIDA_TIMEOUT,
      target: 'desistiu',
    })
  }

  return fluxoSchema.parse(fluxo)
}

function webhookTexto(de: string, texto: string, id: string, numero = numeroDoBot) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: numero },
              contacts: [{ wa_id: de, profile: { name: 'Ana Teste' } }],
              messages: [{ id, from: de, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  }
}

const textos = () =>
  mock.enviadas.filter((e) => e.tipo === 'texto').map((e) => (e as { texto: string }).texto)

/** Faz a tarefa vencer sem esperar meia hora. */
async function vencerAgora(chave: string) {
  await db()
    .from('tarefas')
    .update({ quando: new Date(Date.now() - 60_000).toISOString() })
    .eq('chave', chave)
    .eq('estado', 'pendente')
}

async function tarefaDe(chave: string) {
  const { data } = await db()
    .from('tarefas')
    .select('estado, quando, tentativas')
    .eq('chave', chave)
    .maybeSingle()
  return data as { estado: string; quando: string; tentativas: number } | null
}

let clienteId = ''
let canalId = ''
let semSaidaId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const comSaida = fluxoComPrazo(30, true)
  const fluxo = await criarFluxo(clienteId, `${marca} com prazo`, comSaida)
  const pub = await publicar(fluxo.id, clienteId, comSaida)
  if (!pub.ok) throw new Error(`o fluxo com prazo deveria publicar: ${JSON.stringify(pub.erros)}`)

  const canal = await criarCanal({ clienteId, phoneNumberId: numeroDoBot, flowId: fluxo.id })
  canalId = canal.id

  // Um segundo número, com o mesmo prazo e **sem** a saída ligada: é o caminho
  // que tem que virar handoff em vez de encerrar calado.
  const semSaida = fluxoComPrazo(30, false)
  const outro = await criarFluxo(clienteId, `${marca} sem saída`, semSaida)
  const pub2 = await publicar(outro.id, clienteId, semSaida)
  if (!pub2.ok) throw new Error('o fluxo sem saída deveria publicar')

  const canal2 = await criarCanal({
    clienteId,
    phoneNumberId: `${numeroDoBot}-2`,
    flowId: outro.id,
  })
  semSaidaId = canal2.id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('o prazo da pergunta', () => {
  it('é agendado quando a conversa para na pergunta, e cancelado quando ela responde', async () => {
    const de = telefone(1)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-1`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const sessao = await ultimaSessao(contato!.id as string, canalId)
    const chave = chaveDoTimeout(sessao!.id)

    const agendada = await tarefaDe(chave)
    expect(agendada?.estado).toBe('pendente')
    // Trinta minutos no futuro, com folga para o tempo do próprio teste.
    expect(new Date(agendada!.quando).getTime()).toBeGreaterThan(Date.now() + 25 * 60_000)

    // Responder tira o prazo: cobrar quem já falou é o pior desfecho possível.
    await receberMensagem(webhookTexto(de, 'Só olhando', `wamid-${marca}-2`), comMock)
    expect((await tarefaDe(chave))?.estado).toBe('cancelada')
  })

  it('dispara pela saída "não respondeu" quando o prazo vence', async () => {
    const de = telefone(2)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-3`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const sessao = await ultimaSessao(contato!.id as string, canalId)
    const chave = chaveDoTimeout(sessao!.id)

    await vencerAgora(chave)

    mock.enviadas.length = 0
    const resumo = await rodarTarefas(50, comMock)
    expect(resumo.feitas).toBeGreaterThanOrEqual(1)
    expect(textos()).toContain(DESISTIU)
    expect((await tarefaDe(chave))?.estado).toBe('feita')
  })

  it('sem saída desenhada, o prazo passa a conversa para uma pessoa', async () => {
    const de = telefone(3)
    await receberMensagem(
      webhookTexto(de, 'oi', `wamid-${marca}-4`, `${numeroDoBot}-2`),
      comMock,
    )

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string
    const sessao = await ultimaSessao(contatoId, semSaidaId)
    await vencerAgora(chaveDoTimeout(sessao!.id))

    mock.enviadas.length = 0
    await rodarTarefas(50, comMock)

    // Encerrar calado sumiria com o lead que mais vale a pena resgatar.
    const lead = await acharLead(clienteId, contatoId)
    expect(lead?.aguardando?.motivo).toContain('dentro do prazo')
  })

  it('não faz nada quando a conversa já andou entre agendar e rodar', async () => {
    const de = telefone(4)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-5`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const sessao = await ultimaSessao(contato!.id as string, canalId)
    const chave = chaveDoTimeout(sessao!.id)

    // Vence a tarefa **e** deixa a pessoa responder: é a corrida real, e o que
    // não pode acontecer é ela receber a cobrança depois de ter falado.
    await vencerAgora(chave)
    await db().from('tarefas').update({ estado: 'pendente' }).eq('chave', chave)
    await receberMensagem(webhookTexto(de, 'Falar com alguém', `wamid-${marca}-6`), comMock)

    mock.enviadas.length = 0
    await rodarTarefas(50, comMock)
    expect(textos()).not.toContain(DESISTIU)
  })

  it('não fala com quem está com o bot pausado', async () => {
    const de = telefone(5)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-7`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string
    const sessao = await ultimaSessao(contatoId, canalId)

    await db().from('contacts').update({ automacao_ativa: false }).eq('id', contatoId)
    await vencerAgora(chaveDoTimeout(sessao!.id))

    mock.enviadas.length = 0
    await rodarTarefas(50, comMock)
    expect(mock.enviadas).toEqual([])
  })

  it('reagendar substitui em vez de criar uma segunda cobrança', async () => {
    const de = telefone(6)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-8`), comMock)
    // Uma resposta que o bot não entende faz ele reperguntar — e a espera
    // recomeça. Sem chave única sobrariam dois prazos vivos, e a pessoa
    // receberia a cobrança duas vezes.
    await receberMensagem(webhookTexto(de, 'blablabla', `wamid-${marca}-9`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const sessao = await ultimaSessao(contato!.id as string, canalId)

    const { data } = await db()
      .from('tarefas')
      .select('id')
      .eq('chave', chaveDoTimeout(sessao!.id))
      .eq('estado', 'pendente')

    expect(data?.length).toBe(1)
  })
})
