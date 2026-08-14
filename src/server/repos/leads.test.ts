import { afterAll, describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { fluxoNovo } from '@/core/flow/novo'
import { db } from '../db'
import { criarCliente } from './clientes'
import {
  acharOuCriarContato,
  criarCanal,
  criarSessao,
  confirmarEntrega,
  guardarCampo,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
} from './conversas'
import { criarFluxo, publicar } from './fluxos'
import {
  acharLead,
  contarEsperandoPessoa,
  contarLeads,
  lerConversa,
  limparBusca,
  listarLeads,
  paginarLeads,
} from './leads'

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
  const publicado = await publicar(fluxo.id, cliente.id, fluxo.rascunho)
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
    const saida = await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto: 'Oi! Como ajudo?' })
    await confirmarEntrega(saida)
    await registrarHandoff(sessao.id, 'a pessoa pediu para falar com alguém')

    const [lead] = await listarLeads(cliente.id)
    if (!lead) throw new Error('deveria ter um lead')

    expect(lead.waId).toBe(`${marca}-5544000001`)
    expect(lead.nome).toBe('Ana')
    expect(lead.campos).toEqual({ nome: 'Ana', assunto: 'orçamento' })
    expect(lead.ultimoTexto).toBe('Oi! Como ajudo?')
    expect(lead.ultimaDirecao).toBe('saida')
    expect(lead.ultimaEntregue).toBe(true)
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

  it('deriva etiquetas do histórico sem gravá-las no contato', async () => {
    const { cliente, canal, versaoId } = await montarCliente('etiquetas')

    const abriuComAudio = await acharOuCriarContato(cliente.id, `${marca}-5544000010`, 'Áudio')
    const sessaoDoAudio = await criarSessao(abriuComAudio.id, canal.id, versaoId, sessaoNova())
    await registrarEntrada({
      contatoId: abriuComAudio.id,
      sessaoId: sessaoDoAudio.id,
      waMessageId: idDeMensagem(),
      texto: null,
      payload: { type: 'audio' },
    })
    await registrarEntrada({
      contatoId: abriuComAudio.id,
      sessaoId: sessaoDoAudio.id,
      waMessageId: idDeMensagem(),
      texto: 'agora escrevi',
      payload: { type: 'text' },
    })

    const foiParaPessoa = await acharOuCriarContato(cliente.id, `${marca}-5544000011`, 'Humano')
    const sessaoDoHumano = await criarSessao(foiParaPessoa.id, canal.id, versaoId, sessaoNova())
    for (const texto of ['oi', 'obrigado']) {
      await registrarEntrada({
        contatoId: foiParaPessoa.id,
        sessaoId: sessaoDoHumano.id,
        waMessageId: idDeMensagem(),
        texto,
        payload: { type: 'text' },
      })
    }
    await registrarHandoff(sessaoDoHumano.id, 'quis falar com alguém')
    await db()
      .from('handoffs')
      .update({ resolvido_em: new Date().toISOString() })
      .eq('session_id', sessaoDoHumano.id)

    const naoRespondeu = await acharOuCriarContato(cliente.id, `${marca}-5544000012`, 'Silêncio')
    const sessaoDoSilencio = await criarSessao(naoRespondeu.id, canal.id, versaoId, sessaoNova())
    await registrarEntrada({
      contatoId: naoRespondeu.id,
      sessaoId: sessaoDoSilencio.id,
      waMessageId: idDeMensagem(),
      texto: 'oi',
      payload: { type: 'text' },
    })

    const porContato = new Map(
      (await listarLeads(cliente.id)).map((lead) => [lead.contatoId, lead.etiquetas]),
    )

    expect(porContato.get(abriuComAudio.id)).toEqual(['abriu_com_midia'])
    expect(porContato.get(foiParaPessoa.id)).toEqual(['foi_para_pessoa'])
    expect(porContato.get(naoRespondeu.id)).toEqual(['nao_respondeu'])
  }, 10_000)

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
    const saida = await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto: 'De que serviço?' })
    await confirmarEntrega(saida)
    await registrarEntrada({
      contatoId: contato.id,
      sessaoId: sessao.id,
      waMessageId: idDeMensagem(),
      texto: 'pintura',
      payload: {},
    })

    const conversa = await lerConversa(contato.id)

    expect(conversa.cortada).toBe(false)
    expect(conversa.mensagens.map((m) => [m.direcao, m.texto, m.entregue])).toEqual([
      ['entrada', 'quero um orçamento', true],
      ['saida', 'De que serviço?', true],
      ['entrada', 'pintura', true],
    ])
  })

  it('avisa quando a conversa não coube — em vez de cortar calado', async () => {
    const { cliente, canal, versaoId } = await montarCliente('teto')

    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000006`, null)
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())

    for (const texto of ['um', 'dois', 'três']) {
      const saida = await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto })
      await confirmarEntrega(saida)
    }

    const conversa = await lerConversa(contato.id, 2)

    expect(conversa.cortada).toBe(true)
    // Cortou o começo, não o fim: o que importa é o que acabou de acontecer.
    expect(conversa.mensagens.map((m) => m.texto)).toEqual(['dois', 'três'])
  })

  it('guarda tentativa que o canal não confirmou, sem fingir que foi entregue', async () => {
    const { cliente, canal, versaoId } = await montarCliente('entrega-pendente')
    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544000008`, 'Cris')
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())

    await registrarSaida({ contatoId: contato.id, sessaoId: sessao.id, texto: 'Ainda estou tentando.' })

    const conversa = await lerConversa(contato.id)
    expect(conversa.mensagens).toMatchObject([
      { direcao: 'saida', texto: 'Ainda estou tentando.', entregue: false },
    ])

    const lead = await acharLead(cliente.id, contato.id)
    expect(lead?.ultimaEntregue).toBe(false)
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

  it('pagina sem repetir nem perder ninguém, e conta o filtro inteiro', async () => {
    const { cliente } = await montarCliente('paginado')
    for (let i = 0; i < 5; i++) {
      await acharOuCriarContato(cliente.id, `${marca}-55440001${i}0`, `Pagina ${i}`)
    }

    const primeira = await paginarLeads(cliente.id, { porPagina: 2, pagina: 1 })
    const segunda = await paginarLeads(cliente.id, { porPagina: 2, pagina: 2 })
    const terceira = await paginarLeads(cliente.id, { porPagina: 2, pagina: 3 })

    expect(primeira.total).toBe(5)
    expect(primeira.paginas).toBe(3)
    expect(primeira.leads).toHaveLength(2)
    expect(terceira.leads).toHaveLength(1)

    const vistos = [...primeira.leads, ...segunda.leads, ...terceira.leads].map((l) => l.contatoId)
    expect(new Set(vistos).size).toBe(5)
  }, 15_000)

  it('página fora da faixa cai na última em vez de devolver vazio', async () => {
    const { cliente } = await montarCliente('fora da faixa')
    await acharOuCriarContato(cliente.id, `${marca}-5544000200`, 'Única')

    const longe = await paginarLeads(cliente.id, { porPagina: 2, pagina: 99 })

    expect(longe.pagina).toBe(1)
    expect(longe.leads).toHaveLength(1)
  })

  it('busca por parte do nome e por parte do telefone, só no cliente atual', async () => {
    const dono = await montarCliente('busca')
    const outro = await montarCliente('busca alheia')

    await acharOuCriarContato(dono.cliente.id, `${marca}-5544777001`, 'Mariana Prado')
    await acharOuCriarContato(dono.cliente.id, `${marca}-5544888002`, 'Joana Silva')
    await acharOuCriarContato(outro.cliente.id, `${marca}-5544777003`, 'Mariana de Outro')

    const porNome = await paginarLeads(dono.cliente.id, { busca: 'marian' })
    expect(porNome.leads.map((l) => l.nome)).toEqual(['Mariana Prado'])

    const porTelefone = await paginarLeads(dono.cliente.id, { busca: '888002' })
    expect(porTelefone.leads.map((l) => l.nome)).toEqual(['Joana Silva'])

    // O lead do outro cliente casa com o termo e não pode aparecer aqui.
    expect(porNome.total).toBe(1)
  }, 15_000)

  /**
   * O `or` do PostgREST é uma string com sintaxe. Um termo com vírgula e
   * parêntese não pode virar filtro: viraria escolha de linha por conta própria.
   */
  it('termo com sintaxe de filtro não vira filtro', async () => {
    const { cliente } = await montarCliente('injecao')
    await acharOuCriarContato(cliente.id, `${marca}-5544999001`, 'Alvo')

    const r = await paginarLeads(cliente.id, { busca: 'nome.ilike.*,wa_id.not.is.null' })

    expect(r.total).toBe(0)
    expect(r.leads).toEqual([])
  })

  it('conta leads e fila de atendimento sem trazer a lista', async () => {
    const { cliente, canal, versaoId } = await montarCliente('contagem')
    const contato = await acharOuCriarContato(cliente.id, `${marca}-5544666001`, 'Esperando')
    await acharOuCriarContato(cliente.id, `${marca}-5544666002`, 'Tranquilo')
    const sessao = await criarSessao(contato.id, canal.id, versaoId, sessaoNova())
    await registrarHandoff(sessao.id, 'quer falar com alguém')

    expect(await contarLeads(cliente.id)).toBe(2)
    expect(await contarEsperandoPessoa(cliente.id)).toBe(1)
  }, 10_000)
})

describe('limpeza do termo de busca', () => {
  it('mantém o que aparece em nome e telefone', () => {
    expect(limparBusca('  Mariana Prado ')).toBe('Mariana Prado')
    expect(limparBusca('+55 (44) 9 9999-0000')).toBe('55  44  9 9999-0000')
    expect(limparBusca('joao.silva@exemplo.com')).toBe('joao.silva@exemplo.com')
  })

  it('tira a sintaxe do filtro e o curinga do like', () => {
    expect(limparBusca('a,b')).toBe('a b')
    expect(limparBusca('nome.ilike.*x*')).toBe('nome.ilike. x')
    expect(limparBusca('%')).toBe('')
    expect(limparBusca('a"b\\c')).toBe('a b c')
  })

  it('não deixa termo gigante virar consulta gigante', () => {
    expect(limparBusca('a'.repeat(500))).toHaveLength(60)
  })
})
