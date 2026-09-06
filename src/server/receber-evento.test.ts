import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canalMock } from '@/channels/mock'
import { triagem } from '@/exemplos/triagem'
import { db } from './db'
import { tratarEvento } from './receber-evento'
import { criarCliente } from './repos/clientes'
import { acharOuCriarContato, criarCanal, registrarEntrada } from './repos/conversas'
import { criarFluxo, publicar } from './repos/fluxos'
import { acharLead } from './repos/leads'
import {
  acharGatilhoDeEvento,
  apagarWebhook,
  criarGatilhoDeEvento,
  criarWebhook,
  listarWebhooks,
  segredosAtivos,
} from './repos/webhooks-de-entrada'

/**
 * O evento de fora até a conversa, contra o Supabase de verdade (0044).
 *
 * O que só o banco prova aqui: o segredo indo e voltando do Vault, o índice
 * único do gatilho por evento, e o isolamento entre contas. O mock é só o
 * canal — o que importa é a orquestração, não a rede da Meta.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-ev-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let outroId = ''
let fluxoId = ''
const numeroDoBot = `test-ev-${Math.random().toString(36).slice(2, 10)}`
const mock = canalMock()

beforeAll(async () => {
  if (!temCredencial) return

  const [cliente, outro] = await Promise.all([
    criarCliente(`${marca} cliente`),
    criarCliente(`${marca} outro`),
  ])
  clienteId = cliente.id
  outroId = outro.id

  const fluxo = await criarFluxo(clienteId, `${marca} aviso`, triagem)
  fluxoId = fluxo.id
  const pub = await publicar(fluxo.id, clienteId, triagem)
  if (!pub.ok) throw new Error('o fluxo de exemplo deveria publicar')

  await criarCanal({ clienteId, phoneNumberId: numeroDoBot, flowId: fluxo.id })
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  await db().from('clients').delete().eq('id', clienteId)
  await db().from('clients').delete().eq('id', outroId)
})

describe.skipIf(!temCredencial)('o segredo do webhook', () => {
  it('nasce no cofre e sai uma vez só', async () => {
    const criado = await criarWebhook(clienteId, `${marca} verandi`)
    expect(criado.ok).toBe(true)
    if (!criado.ok) return

    // Forte de verdade: 32 bytes em base64url dão 43 caracteres.
    expect(criado.segredo.length).toBeGreaterThanOrEqual(43)

    // **A linha não guarda o valor.** É o tipo que impede, não a disciplina de
    // quem escreve a tela.
    const lista = await listarWebhooks(clienteId)
    const salvo = lista.find((w) => w.id === criado.id)!
    expect(salvo).toBeDefined()
    expect(JSON.stringify(salvo)).not.toContain(criado.segredo)

    // E o cofre devolve o mesmo valor para quem confere a assinatura.
    const segredos = await segredosAtivos(clienteId)
    expect(segredos.find((s) => s.id === criado.id)?.segredo).toBe(criado.segredo)
  })

  it('o segredo de uma conta não aparece na outra', async () => {
    const meu = await criarWebhook(clienteId, `${marca} isolado`)
    if (!meu.ok) return

    const doOutro = await segredosAtivos(outroId)
    expect(doOutro.map((s) => s.segredo)).not.toContain(meu.segredo)
  })

  it('apagar leva o segredo junto', async () => {
    const criado = await criarWebhook(clienteId, `${marca} efêmero`)
    if (!criado.ok) return

    expect(await apagarWebhook(clienteId, criado.id)).toBe(true)
    const segredos = await segredosAtivos(clienteId)
    expect(segredos.map((s) => s.id)).not.toContain(criado.id)
  })

  it('não apaga webhook de outra conta pelo id', async () => {
    const criado = await criarWebhook(clienteId, `${marca} alheio`)
    if (!criado.ok) return
    expect(await apagarWebhook(outroId, criado.id)).toBe(false)
  })
})

describe.skipIf(!temCredencial)('o gatilho de evento', () => {
  it('recusa dois fluxos para o mesmo evento', async () => {
    const primeiro = await criarGatilhoDeEvento(clienteId, 'vaga.aberta', fluxoId)
    expect(primeiro.ok).toBe(true)

    // Sem desempate possível: ao contrário do texto, não há "mais específico"
    // entre dois nomes iguais.
    const segundo = await criarGatilhoDeEvento(clienteId, 'Vaga.Aberta', fluxoId)
    expect(segundo.ok).toBe(false)
  })

  it('recusa fluxo de outra conta', async () => {
    const r = await criarGatilhoDeEvento(outroId, 'roubado', fluxoId)
    expect(r).toEqual({ ok: false, motivo: 'este fluxo não é deste cliente' })
  })

  it('o gatilho de uma conta não é achado pela outra', async () => {
    expect(await acharGatilhoDeEvento(clienteId, 'vaga.aberta')).not.toBeNull()
    expect(await acharGatilhoDeEvento(outroId, 'vaga.aberta')).toBeNull()
  })
})

describe.skipIf(!temCredencial)('o evento vira conversa', () => {
  it('evento sem gatilho não faz nada, e não é erro', async () => {
    const r = await tratarEvento({
      clienteId,
      evento: 'ninguem.assinou',
      telefone: `5511${seed}01`,
    })
    expect(r).toBe('sem_gatilho')
  })

  it('telefone que não é contato desta conta não cria contato do nada', async () => {
    // A coisa fácil seria criar; seria a errada. Um sistema externo com número
    // digitado errado encheria a base de leads-fantasma que nunca falaram com
    // ninguém.
    const antes = await db().from('contacts').select('id').eq('client_id', clienteId)

    const r = await tratarEvento({
      clienteId,
      evento: 'vaga.aberta',
      telefone: `5511${seed}99`,
    })
    expect(r).toBe('sem_contato')

    const depois = await db().from('contacts').select('id').eq('client_id', clienteId)
    expect(depois.data?.length ?? 0).toBe(antes.data?.length ?? 0)
  })

  it('telefone sem DDD não casa com ninguém em vez de chutar', async () => {
    // `98765-4321` pode ser de onze estados. Chutar o DDD casaria o evento de
    // uma pessoa com o cadastro de outra, que é pior que não avisar.
    const r = await tratarEvento({ clienteId, evento: 'vaga.aberta', telefone: '987654321' })
    expect(r).toBe('sem_contato')
  })

  it('contato que nunca escreveu tem a janela fechada: registra e não envia', async () => {
    /**
     * **O caso mais importante desta rodada.** Sem modelo aprovado (travado
     * pela Meta), avisar fora da janela de 24h é impossível — e prometer o
     * aviso mesmo assim seria trocar o defeito de lugar. O honesto é gravar na
     * ficha e deixar visível para quem abre o Inbox.
     */
    const telefone = `5511${seed}02`
    const contato = await acharOuCriarContato(clienteId, telefone, 'Sem conversa')

    mock.enviadas.length = 0
    const r = await tratarEvento({
      clienteId,
      evento: 'vaga.aberta',
      telefone,
      dados: { horario: '19h', professora: 'Ana' },
    })
    expect(r).toBe('janela_fechada')

    // Nada foi enviado.
    expect(mock.enviadas).toHaveLength(0)

    // E ficou registrado, com o que o evento trazia.
    const lead = await acharLead(clienteId, contato.id)
    expect(lead?.notas).toContain('vaga.aberta')
    expect(lead?.notas).toContain('janela de 24h')
    expect(lead?.notas).toContain('19h')
  })

  it('o telefone casa com nono dígito de diferença', async () => {
    // O sistema de fora pode ter `11 8765-4321` e o WhatsApp guardou
    // `5511987654321`. Casar só pela forma exata deixaria metade da base sem
    // aviso por um dígito que o Brasil acrescentou em 2012.
    // Guardado com o nono: DDI(2) + DDD(2) + 9 + oito dígitos = 13.
    const oito = `8${seed.slice(0, 7)}`
    const comNove = `55119${oito}`
    expect(comNove).toHaveLength(13)
    await acharOuCriarContato(clienteId, comNove, 'Com nono')

    // O sistema de fora manda a forma antiga: DDI + DDD + oito dígitos = 12.
    const semNove = `5511${oito}`
    expect(semNove).toHaveLength(12)

    const r = await tratarEvento({ clienteId, evento: 'vaga.aberta', telefone: semNove })

    // Achou o contato — o que prova é não ter sido `sem_contato`.
    expect(r).not.toBe('sem_contato')
  })

  it('o evento de uma conta não alcança o contato da outra', async () => {
    const telefone = `5511${seed}03`
    await acharOuCriarContato(clienteId, telefone, 'Meu')

    // A outra conta tem gatilho próprio e o mesmo telefone não é dela.
    const gatilhoAlheio = await criarGatilhoDeEvento(outroId, 'vaga.aberta', fluxoId)
    expect(gatilhoAlheio.ok).toBe(false)

    const r = await tratarEvento({ clienteId: outroId, evento: 'vaga.aberta', telefone })
    expect(r).toBe('sem_gatilho')
  })

  it('com a janela aberta, o evento começa o fluxo do gatilho', async () => {
    // O caminho feliz, e o único que prova a rodada inteira: a Verandi avisa
    // que abriu vaga, e quem estava na fila recebe a mensagem.
    const telefone = `5511${seed}04`
    const contato = await acharOuCriarContato(clienteId, telefone, 'Na fila')

    // A janela abre com uma mensagem **de entrada** da pessoa. Sem isso, o
    // contato existe e a Meta recusaria qualquer texto livre.
    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: null,
      waMessageId: `wamid-${marca}-fila-1`,
      texto: 'tem vaga?',
      payload: {},
    })

    mock.enviadas.length = 0
    const r = await tratarEvento({ clienteId, evento: 'vaga.aberta', telefone }, () => mock)

    expect(r).toBe('aberto')
    // E a pessoa foi avisada de verdade — é o que a promessa do preset dizia.
    expect(mock.enviadas.length).toBeGreaterThan(0)
  })

  it('conta o disparo do gatilho', async () => {
    const antes = (await acharGatilhoDeEvento(clienteId, 'vaga.aberta'))!.execucoes
    await tratarEvento({ clienteId, evento: 'vaga.aberta', telefone: `5511${seed}02` })
    const depois = (await acharGatilhoDeEvento(clienteId, 'vaga.aberta'))!.execucoes
    expect(depois).toBe(antes + 1)
  })
})
