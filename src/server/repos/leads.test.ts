import { afterAll, describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  acharOuCriarContato,
  criarCanal,
  criarSessao,
  guardarCampo,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
} from './conversas'
import { criarFluxo, publicar } from './fluxos'
import { acharLead, lerConversa, listarLeads } from './leads'

/**
 * Fala com o Supabase de verdade, igual aos outros. O que precisa ser provado
 * aqui é a view `leads` (0004) — e view é objeto do banco: mock nenhum diz se
 * o `left join lateral` traz a linha certa.
 *
 * Cria tudo com um nome carimbado e apaga no fim. Sem `.env`, pula.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-teste-${Math.random().toString(36).slice(2, 8)}`
const criados: string[] = []

afterAll(async () => {
  if (!temCredencial) return
  for (const id of criados) {
    // `on delete cascade` leva canal, contato, sessão, mensagem e handoff junto.
    await db().from('clients').delete().eq('id', id)
  }
})

let sequencia = 0
const idDeMensagem = () => `${marca}-msg-${++sequencia}`

/** Um cliente com número conectado e fluxo publicado — o mínimo para haver lead. */
async function montarCliente(nome: string) {
  const cliente = await criarCliente(`${marca} ${nome}`)
  criados.push(cliente.id)

  const fluxo = await criarFluxo(cliente.id, `${marca} f`, fluxoNovo())
  const publicado = await publicar(fluxo.id, fluxo.rascunho)
  if (!publicado.ok) throw new Error('o fluxo de teste deveria ter publicado')

  const canal = await criarCanal({
    clienteId: cliente.id,
    phoneNumberId: `${marca}-${nome}-numero`,
    flowId: fluxo.id,
  })

  return { cliente, canal, versaoId: publicado.versao.id }
}

describe.skipIf(!temCredencial)('leads contra o Supabase', () => {
  it('monta o lead com o que o fluxo coletou, o handoff aberto e a última mensagem', async () => {
    const { cliente, canal, versaoId } = await montarCliente('completo')

    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000001`, 'Ana')
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())

    await guardarCampo(contato.id, { nome: 'Ana', assunto: 'orçamento' })
    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'oi',
      payload: {},
    })
    await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto: 'Oi! Como ajudo?' })
    await registrarHandoff(sessao.id, 'a pessoa pediu para falar com alguém')

    const [lead] = await listarLeads(cliente.id)
    if (!lead) throw new Error('deveria ter um lead')

    expect(lead.waId).toBe(`${marca}-5544000001`)
    expect(lead.nome).toBe('Ana')
    expect(lead.campos).toEqual({ nome: 'Ana', assunto: 'orçamento' })
    expect(lead.ultimoTexto).toBe('Oi! Como ajudo?')
    expect(lead.ultimaDirecao).toBe('saida')
    expect(lead.aguardando?.motivo).toBe('a pessoa pediu para falar com alguém')

    // A mesma linha tem que vir pelo caminho de um lead só.
    const sozinho = await acharLead(cliente.id, contato.id)
    expect(sozinho).toEqual(lead)
  })

  it('handoff resolvido não deixa o lead aguardando', async () => {
    const { cliente, canal, versaoId } = await montarCliente('resolvido')

    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000002`, null)
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())
    await registrarHandoff(sessao.id, 'atendida')

    const antes = await acharLead(cliente.id, contato.id)
    expect(antes?.aguardando).not.toBeNull()

    await db()
      .from('handoffs')
      .update({ resolvido_em: new Date().toISOString() })
      .eq('session_id', sessao.id)

    const depois = await acharLead(cliente.id, contato.id)
    expect(depois?.aguardando).toBeNull()
  })

  it('quem nunca escreveu aparece na lista, e vai depois de quem escreveu', async () => {
    const { cliente, canal, versaoId } = await montarCliente('ordem')

    const calado = await acharOuCriarContato(cliente.id, `${marca}-5544000003`, 'Calado')
    const falante = await acharOuCriarContato(cliente.id, `${marca}-5544000004`, 'Falante')
    const sessao = await criarSessao(falante.id, canal.id, versaoId, sessaoNova())
    await registrarEntrada({
      contatoId: falante.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'bom dia',
      payload: {},
    })

    const [primeiro, segundo] = await listarLeads(cliente.id)

    expect([primeiro?.contatoId, segundo?.contatoId]).toEqual([falante.id, calado.id])
    expect(segundo?.ultimaEm).toBeNull()
    expect(segundo?.campos).toEqual({})
  })

  it('devolve a conversa na ordem em que aconteceu, separando entrada e saída', async () => {
    const { cliente, canal, versaoId } = await montarCliente('conversa')

    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000005`, 'Bia')
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())

    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'quero um orçamento',
      payload: {},
    })
    await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto: 'De que serviço?' })
    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'pintura',
      payload: {},
    })

    const conversa = await lerConversa(contato.id)

    expect(conversa.cortada).toBe(false)
    expect(conversa.mensagens.map((m) => [m.direcao, m.texto])).toEqual([
      ['entrada', 'quero um orçamento'],
      ['saida', 'De que serviço?'],
      ['entrada', 'pintura'],
    ])
  })

  it('avisa quando a conversa não coube — em vez de cortar calado', async () => {
    const { cliente, canal, versaoId } = await montarCliente('teto')

    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000006`, null)
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())

    for (const texto of ['um', 'dois', 'três']) {
      await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto })
    }

    const conversa = await lerConversa(contato.id, 2)

    expect(conversa.cortada).toBe(true)
    // Cortou o começo, não o fim: o que importa é o que acabou de acontecer.
    expect(conversa.mensagens.map((m) => m.texto)).toEqual(['dois', 'três'])
  })

  /** A URL é adivinhável. O id certo no cliente errado não pode abrir. */
  it('não devolve o lead de um cliente pelo id de outro', async () => {
    const dono = await montarCliente('dono')
    const estranho = await montarCliente('estranho')

    const contato = await acharOuCriarContato(dono.cliente.id, `${marca}-5544000007`, 'Dona')

    expect(await acharLead(dono.cliente.id, contato.id)).not.toBeNull()
    expect(await acharLead(estranho.cliente.id, contato.id)).toBeNull()
  })

  it('devolve null para contato que não existe', async () => {
    const { cliente } = await montarCliente('vazio')
    expect(await acharLead(cliente.id, '00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await listarLeads(cliente.id)).toEqual([])
  })
})
