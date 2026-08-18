import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dentroDaJanela } from '@/channels/janela'
import { canalMock } from '@/channels/mock'
import { triagem } from '@/exemplos/triagem'
import { db } from './db'
import { receberMensagem } from './receber-mensagem'
import { criarCliente } from './repos/clientes'
import {
  contextoDeResposta,
  criarCanal,
  encerrarAtendimento,
  ultimaSessao,
} from './repos/conversas'
import { criarFluxo, publicar, salvarRascunho } from './repos/fluxos'
import { acharLead, lerConversa } from './repos/leads'

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

/**
 * Telefone de teste: 7 dígitos sorteados uma vez por execução + 2 do índice.
 *
 * Antes cada teste montava o número a partir de `Date.now()` mais um
 * deslocamento fixo. Parece único e não é: o carimbo é lido no instante em que
 * **cada** teste roda, então dois testes que caem no mesmo milissegundo com
 * deslocamentos vizinhos produzem o mesmo `wa_id`, e o `.single()` que espera
 * uma linha acha duas. O banco é o de verdade e contato de teste sobrevive à
 * execução que o criou, então a colisão também atravessa execuções.
 *
 * Amarrar ao sorteio da execução dá o mesmo isolamento que `marca` já dá aos
 * `wamid`, e o número continua rastreável até a execução que o criou.
 */
const seedTelefone = Math.floor(Math.random() * 1e7)
  .toString()
  .padStart(7, '0')
const telefone = (indice: number) => `5511${seedTelefone}${indice.toString().padStart(2, '0')}`

/** O formato que a Meta manda de verdade. */
function webhookTexto(
  de: string,
  texto: string,
  id: string,
  referral?: Record<string, string>,
) {
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
              messages: [
                {
                  id,
                  from: de,
                  type: 'text',
                  text: { body: texto },
                  ...(referral ? { referral } : {}),
                },
              ],
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

  const fluxoComAtraso = structuredClone(triagem)
  const abertura = fluxoComAtraso.nodes.find((no) => no.id === 'abertura')
  if (abertura?.type !== 'mensagem') throw new Error('a triagem deveria começar com mensagem')
  Object.assign(abertura.data, { atraso: 1 })

  const fluxo = await criarFluxo(cliente.id, `${marca} triagem`, fluxoComAtraso)
  fluxoId = fluxo.id
  const pub = await publicar(fluxo.id, cliente.id, fluxoComAtraso)
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
    const de = telefone(0)
    const mensagemId = `wamid-${marca}-1`

    await receberMensagem(webhookTexto(de, 'oi', mensagemId), comMock)

    expect(mock.enviadas[0]).toEqual({ tipo: 'espera', mensagemId, atrasoMs: 1_000 })
    expect(mock.enviadas[1]).toMatchObject({ tipo: 'texto', para: de })
    expect(mock.enviadas.find((e) => e.tipo === 'opcoes')).toMatchObject({ formato: 'botoes' })
  })

  it('guarda o anúncio que trouxe o contato na primeira mensagem', async () => {
    const de = telefone(15)
    const referral = {
      source_url: 'https://fb.me/3Exemplo',
      source_type: 'ad',
      source_id: '120210000000001',
      headline: 'Filme institucional para sua empresa',
      body: 'Conte sua história com a Prelúdio',
      media_type: 'image',
      image_url: 'https://lookaside.fbsbx.com/exemplo.jpg',
      ctwa_clid: 'ARAzExemploDeClickId',
    }

    await receberMensagem(
      webhookTexto(de, 'Quero um orçamento', `wamid-${marca}-referral-1`, referral),
      comMock,
    )

    const { data } = await db().from('contacts').select('campos').eq('wa_id', de).single()
    expect(data?.campos).toMatchObject({
      origem: 'Anúncio',
      origem_anuncio: referral.source_id,
      origem_titulo: referral.headline,
    })
  })

  it('marca entrada direta e não troca a origem numa mensagem futura', async () => {
    const de = telefone(16)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-direto-1`), comMock)
    await receberMensagem(
      webhookTexto(de, 'voltei por um anúncio', `wamid-${marca}-direto-2`, {
        source_id: '120210000000002',
        headline: 'Outro anúncio',
      }),
      comMock,
    )

    const { data } = await db().from('contacts').select('campos').eq('wa_id', de).single()
    expect(data?.campos).toEqual({ origem: 'Direto' })
  })

  it('ignora reenvio da mesma mensagem — senão a conversa anda duas vezes', async () => {
    const de = telefone(1)
    const idRepetido = `wamid-${marca}-dup`

    await receberMensagem(webhookTexto(de, 'oi', idRepetido), comMock)
    const depoisDaPrimeira = mock.enviadas.length

    await receberMensagem(webhookTexto(de, 'oi', idRepetido), comMock)
    expect(mock.enviadas.length).toBe(depoisDaPrimeira)
  })

  it('clicar num botão avança o fluxo e guarda a resposta no contato', async () => {
    const de = telefone(2)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-3a`), comMock)

    mock.enviadas.length = 0
    await receberMensagem(webhookBotao(de, 'casamento', `wamid-${marca}-3b`), comMock)

    expect(mock.enviadas.some((e) => e.tipo === 'texto' && e.texto.includes('Como posso te chamar'))).toBe(true)

    const { data } = await db().from('contacts').select('campos').eq('wa_id', de).single()
    expect((data?.campos as Record<string, string>).tipo).toBe('Casamento')
  })

  it('áudio vai para uma pessoa em vez de "não entendi" (Regra B)', async () => {
    const de = telefone(3)
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
    const de = telefone(4)
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
    const de = telefone(5)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-6a`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const antes = await ultimaSessao(contato!.id as string, canalId)

    // publica uma versão nova, bem diferente
    const outro = structuredClone(triagem)
    const abertura = outro.nodes.find((n) => n.id === 'abertura')
    if (abertura?.type === 'mensagem') abertura.data.texto = 'FLUXO NOVO'
    await salvarRascunho(fluxoId, clienteId, outro)
    const pub = await publicar(fluxoId, clienteId, outro)
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

  /**
   * O caso que estava aberto: a Cloud API recusa o envio (token expirado,
   * janela de 24h fechada, limite de taxa) e a exceção subia até o `after()`
   * do webhook. Como a mensagem que chegou já foi deduplicada, a Meta não
   * reenvia — a pessoa ficava sem resposta e o fluxo tinha avançado como se
   * tivesse falado. Agora vira handoff, que é o que a tela consegue mostrar.
   */
  it('falha de entrega vira handoff, e não exceção sem dono', async () => {
    const de = telefone(6)
    const quebrado = canalQueRecusa('(#131047) Re-engagement message')

    await expect(
      receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-8`), () => quebrado),
    ).resolves.toBeUndefined()

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const salva = await ultimaSessao(contato!.id as string, canalId)
    expect(salva?.sessao.status).toBe('humano')

    const { data: handoffs } = await db()
      .from('handoffs')
      .select('motivo')
      .eq('session_id', salva!.id)
    expect(handoffs?.[0]?.motivo).toContain('não deu para entregar')
    expect(handoffs?.[0]?.motivo).toContain('131047')
  })

  /**
   * Uma saudação seguida de opções são dois envios. Falhando o segundo, o
   * primeiro já saiu — seguir para um terceiro entregaria a conversa fora de
   * ordem, que é pior do que uma pessoa assumindo.
   */
  it('entrega que falha no meio para o resto em vez de mandar fora de ordem', async () => {
    const de = telefone(7)
    const soAPrimeira = canalQueRecusa('canal caiu', 1)

    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-9`), () => soAPrimeira)

    expect(soAPrimeira.tentativas).toBe(2)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string

    // A que falhou fica no histórico como tentativa, mas não como entrega. É a
    // informação necessária para investigar sem dizer à pessoa que ela recebeu.
    const conversa = await lerConversa(contatoId)
    expect(conversa.mensagens.filter((m) => m.direcao === 'saida').map((m) => m.entregue)).toEqual([
      true,
      false,
    ])

    const salva = await ultimaSessao(contatoId, canalId)
    expect(salva?.sessao.status).toBe('humano')
  })

  /**
   * O botão "Já atendi" da tela de leads. Sem ele o lead ficava vermelho para
   * sempre — e, pior, a sessão continuava em `humano`, então o bot nunca mais
   * falava com aquele número.
   */
  it('encerrar o atendimento resolve o handoff e devolve o contato ao bot', async () => {
    const de = telefone(8)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-10a`), comMock)
    await receberMensagem(webhookAudio(de, `wamid-${marca}-10b`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string

    expect((await acharLead(clienteId, contatoId))?.aguardando).not.toBeNull()

    expect(await encerrarAtendimento(clienteId, contatoId)).toEqual({ ok: true })

    expect((await acharLead(clienteId, contatoId))?.aguardando).toBeNull()

    mock.enviadas.length = 0
    await receberMensagem(webhookTexto(de, 'voltei', `wamid-${marca}-10c`), comMock)
    expect(mock.enviadas.length).toBeGreaterThan(0)
  })

  /**
   * Duas mensagens da mesma pessoa, quase juntas.
   *
   * É o comportamento normal de quem manda "oi" e "tudo bem?" em seguida: a
   * Meta entrega os dois webhooks, e nada garante que o segundo espere o
   * primeiro. Sem trava, os dois leem a sessão no mesmo estado — e como o
   * primeiro ainda não gravou nada, o segundo também acha que a conversa é
   * nova e **cria uma segunda sessão**. A conversa reinicia sozinha, e quem
   * está do outro lado vê a saudação duas vezes.
   *
   * A asserção é uma sessão só. É a forma mais direta de dizer "os dois
   * passaram pelo mesmo funil, um depois do outro".
   */
  it('duas mensagens ao mesmo tempo não criam duas sessões', async () => {
    const de = telefone(14)
    mock.enviadas.length = 0

    await Promise.all([
      receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-14a`), comMock),
      receberMensagem(webhookTexto(de, 'tudo bem?', `wamid-${marca}-14b`), comMock),
    ])

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const { data: sessoes } = await db()
      .from('sessions')
      .select('id')
      .eq('contact_id', contato!.id as string)

    expect(sessoes).toHaveLength(1)

    // E o que a pessoa veria: a saudação uma vez, não duas. É o sintoma que a
    // trava existe para evitar — a sessão duplicada é a causa, esta é a cara.
    const saudacao = mock.enviadas.find((e) => e.tipo === 'texto')
    expect(saudacao).toBeDefined()
    const repetidas = mock.enviadas.filter(
      (e) => e.tipo === 'texto' && e.texto === (saudacao as { texto: string }).texto,
    )
    expect(repetidas).toHaveLength(1)
  })

  /**
   * O que a caixa de resposta do painel precisa saber antes de deixar alguém
   * digitar: por qual número a resposta sai, e se a janela de 24h está aberta.
   */
  it('monta o contexto de resposta com o canal em que a pessoa escreveu', async () => {
    const de = telefone(12)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-12`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contexto = await contextoDeResposta(clienteId, contato!.id as string)

    expect(contexto?.waId).toBe(de)
    expect(contexto?.canal.phoneNumberId).toBe(numeroDoBot)
    expect(contexto?.sessaoId).toBeTruthy()
    // Ela acabou de escrever, então a janela tem que estar aberta.
    expect(dentroDaJanela(contexto?.ultimaEntradaEm ?? null)).toBe(true)
  })

  it('não monta contexto de resposta para o contato de outro cliente', async () => {
    const de = telefone(13)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-13`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()

    const outro = await criarCliente(`${marca} intruso 2`)
    try {
      expect(await contextoDeResposta(outro.id, contato!.id as string)).toBeNull()
    } finally {
      await db().from('clients').delete().eq('id', outro.id)
    }
  })

  it('não encerra o atendimento de um contato pelo id de outro cliente', async () => {
    const de = telefone(9)
    await receberMensagem(webhookTexto(de, 'oi', `wamid-${marca}-11a`), comMock)
    await receberMensagem(webhookAudio(de, `wamid-${marca}-11b`), comMock)

    const { data: contato } = await db().from('contacts').select('id').eq('wa_id', de).single()
    const contatoId = contato!.id as string

    const outro = await criarCliente(`${marca} intruso`)
    try {
      expect(await encerrarAtendimento(outro.id, contatoId)).toEqual({ ok: false })
      expect((await acharLead(clienteId, contatoId))?.aguardando).not.toBeNull()
    } finally {
      await db().from('clients').delete().eq('id', outro.id)
    }
  })
})

/**
 * Um canal que recusa o envio, como a Cloud API faz quando o token expirou ou
 * a janela de 24h fechou. `aPartirDe` deixa as primeiras entregas passarem,
 * para exercitar a falha no meio de uma sequência.
 */
function canalQueRecusa(motivo: string, aPartirDe = 0) {
  let tentativas = 0
  const recusar = async () => {
    tentativas += 1
    if (tentativas > aPartirDe) throw new Error(`Cloud API respondeu 400: ${motivo}`)
  }

  return {
    get tentativas() {
      return tentativas
    },
    async aguardarResposta() {},
    enviarTexto: recusar,
    enviarOpcoes: recusar,
  }
}
