import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canalMock } from '@/channels/mock'
import { triagem } from '@/exemplos/triagem'
import { db } from './db'
import { abrirFluxoParaContato } from './receber-mensagem'
import { criarCliente } from './repos/clientes'
import { acharOuCriarContato, criarCanal, ultimaSessao } from './repos/conversas'
import { criarFluxo, publicar } from './repos/fluxos'

/**
 * A prioridade humana no envio automático (RB-48, T7.3).
 *
 * ---------------------------------------------------------------------------
 * O defeito medido, e ele não aparecia em log nenhum
 * ---------------------------------------------------------------------------
 *
 * `abrirFluxoParaContato` encerrava a sessão anterior **qualquer que fosse o
 * status dela**, inclusive `humano`:
 *
 *     const anterior = await ultimaSessao(contatoId, contexto.canal.id)
 *     if (anterior && anterior.sessao.status !== 'encerrada') {
 *       await definirStatusDaSessao(anterior.id, 'encerrada')
 *     }
 *
 * Então um passo de sequência que vencesse durante um atendimento derrubava o
 * handoff e punha o bot de volta na conversa, no meio do assunto que uma pessoa
 * estava resolvendo. Não havia erro: a sessão "encerrou" e outra "abriu", as
 * duas coisas normais. Quem atendia via o bot responder por cima dela.
 *
 * A RB-48: "durante atendimento humano ou pausa persistente, suspender envios
 * automáticos conflitantes [...] inclusive em jobs já enfileirados".
 *
 * ---------------------------------------------------------------------------
 * Por que contra o banco
 * ---------------------------------------------------------------------------
 *
 * Porque o que precisa ser provado é que a sessão `humano` **continua** `humano`
 * depois da tentativa. É estado gravado, e um mock de repositório provaria só que
 * o código chama o que eu disse para ele chamar.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-prio-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')
const mock = canalMock()
const comMock = () => mock

let clienteId = ''
let contatoId = ''
let canalId = ''
let fluxoId = ''

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const fluxo = await criarFluxo(clienteId, `${marca} fluxo`, triagem)
  fluxoId = fluxo.id
  const pub = await publicar(fluxoId, clienteId, triagem)
  if (!pub.ok) throw new Error('fixture: publicar')

  const canal = await criarCanal({
    clienteId,
    phoneNumberId: `${marca}-numero`,
    flowId: fluxoId,
  })
  canalId = canal.id

  const contato = await acharOuCriarContato(clienteId, `5511${seed}01`, 'Ana')
  contatoId = contato.id

  /*
   * A janela de 24h precisa estar aberta, senão a recusa vem por
   * `janela_fechada` e o teste provaria outra coisa. Uma mensagem de entrada
   * recente é o que abre a janela.
   *
   * **O vocabulário desta tabela é o antigo, e ele morde duas vezes.** `messages`
   * usa `ts` e não `criado_em`, não tem `client_id`, e **não tem `channel_id`**:
   * o vínculo com o número é por `session_id`, que aqui pode ficar nulo. A tabela
   * nasceu antes do português do resto do schema.
   */
  const { error: erroDaMensagem } = await db()
    .from('messages')
    .insert({
      contact_id: contatoId,
      direcao: 'entrada',
      ts: new Date().toISOString(),
      // `historico = false` **não é arrumação: é a janela de 24h.** Conversa
      // importada da coexistência entra como entrada e não abre janela nenhuma
      // da Cloud API, então `contextoDeResposta` só conta o que veio do webhook.
      historico: false,
      wa_message_id: `${marca}-wamid`,
      payload: { text: { body: 'oi' } },
    })
  if (erroDaMensagem) throw new Error(`fixture da mensagem: ${erroDaMensagem.message}`)
})

afterAll(async () => {
  if (!temCredencial) return
  if (clienteId) await db().from('clients').delete().eq('id', clienteId)
})

/** Põe uma sessão no status pedido, direto no banco. É fixture. */
async function sessaoCom(status: string): Promise<string> {
  await db().from('sessions').delete().eq('contact_id', contatoId)

  const { data: versao } = await db()
    .from('flow_versions')
    .select('id')
    .eq('flow_id', fluxoId)
    .limit(1)
    .single()

  const { data, error } = await db()
    .from('sessions')
    .insert({
      contact_id: contatoId,
      channel_id: canalId,
      flow_version_id: (versao as { id: string }).id,
      no_atual: 'abertura',
      vars: {},
      tentativas: 0,
      status,
    })
    .select('id')
    .single()

  if (error) throw new Error(`fixture da sessão: ${error.message}`)
  return (data as { id: string }).id
}

describe.skipIf(!temCredencial)('atendimento humano em curso', () => {
  it('recusa a abertura automática, e NÃO derruba o atendimento', async () => {
    const sessaoId = await sessaoCom('humano')
    mock.enviadas.length = 0

    const r = await abrirFluxoParaContato(clienteId, contatoId, fluxoId, comMock)

    /*
     * **As três asserções que são o ponto da tarefa.** A recusa tem nome próprio,
     * a sessão de atendimento continua de pé, e nada foi enviado ao cliente: as
     * três, porque cada uma sozinha passaria com a implementação errada.
     */
    expect(r).toBe('atendimento_humano')

    const depois = await ultimaSessao(contatoId, canalId)
    expect(depois?.id).toBe(sessaoId)
    expect(depois?.sessao.status).toBe('humano')

    expect(mock.enviadas).toHaveLength(0)
  })

  it('sessão encerrada não impede: é o caminho do pós-atendimento', async () => {
    /*
     * O contraponto que impede a guarda de ser larga demais. O pós-atendimento
     * (A6) roda **depois** de `encerrarAtendimento`, que já levou a sessão de
     * `humano` para `encerrada`. Se a guarda pegasse esse caso, o quarto papel do
     * número deixaria de funcionar, em silêncio.
     */
    await sessaoCom('encerrada')
    const r = await abrirFluxoParaContato(clienteId, contatoId, fluxoId, comMock)
    expect(r).toBe('aberto')
  })

  it('sessão ativa do bot não impede: ela é substituída, como sempre foi', async () => {
    // Sessão `ativa` é conversa do próprio bot, e abrir outra por sequência
    // encerra a anterior: é o comportamento antigo, e ele está certo.
    await sessaoCom('ativa')
    const r = await abrirFluxoParaContato(clienteId, contatoId, fluxoId, comMock)
    expect(r).toBe('aberto')
  })

  it('sem sessão nenhuma abre normalmente', async () => {
    await db().from('sessions').delete().eq('contact_id', contatoId)
    const r = await abrirFluxoParaContato(clienteId, contatoId, fluxoId, comMock)
    expect(r).toBe('aberto')
  })
})
