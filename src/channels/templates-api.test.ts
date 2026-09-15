import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apagarTemplateNaMeta,
  criarTemplateNaMeta,
  listarTemplatesDaMeta,
} from './templates-api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function responder(corpo: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const BASE = {
  wabaId: 'waba-1',
  token: 'token-de-teste',
  nome: 'lembrete_de_consulta',
  idioma: 'pt_BR',
  categoria: 'UTILITY' as const,
  versaoGraph: 'v25.0',
}

describe('criar template na Meta', () => {
  it('bate no nó da WABA, com nome, idioma, categoria e componentes', async () => {
    const fetchMock = responder({ id: '123', status: 'PENDING', category: 'UTILITY' })

    await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'Olá, tudo bem?' } })

    const [url, opcoes] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://graph.facebook.com/v25.0/waba-1/message_templates')
    expect(opcoes.method).toBe('POST')
    expect(JSON.parse(opcoes.body as string)).toEqual({
      name: 'lembrete_de_consulta',
      language: 'pt_BR',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Olá, tudo bem?' }],
    })
  })

  it('devolve o id, o status e a categoria que a Meta decidiu', async () => {
    responder({ id: '123', status: 'PENDING', category: 'UTILITY' })

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r).toEqual({
      ok: true,
      template: { wabaTemplateId: '123', status: 'pendente', categoria: 'UTILITY' },
    })
  })

  /*
   * A Meta reclassifica sozinha quando acha o conteúdo promocional — e a
   * categoria muda o PREÇO da mensagem. Gravar o que pedimos em vez do que ela
   * respondeu faria a tabela de custo mentir.
   */
  it('devolve a categoria da Meta mesmo quando ela difere da pedida', async () => {
    responder({ id: '123', status: 'PENDING', category: 'MARKETING' })

    const r = await criarTemplateNaMeta({
      ...BASE,
      categoria: 'UTILITY',
      componentes: { corpo: 'aproveite nossa promoção' },
    })

    expect(r.ok && r.template.categoria).toBe('MARKETING')
  })

  it('leva o erro da Meta com o código, sem estourar', async () => {
    responder({ error: { code: 100, message: 'name already exists' } }, 400)

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r).toEqual({
      ok: false,
      erro: { codigo: 100, mensagem: 'name already exists' },
    })
  })

  it('prefere a mensagem escrita para o usuário à mensagem de programador', async () => {
    responder(
      {
        error: {
          code: 100,
          message: '(#100) Invalid parameter',
          error_user_msg: 'Esse nome já está em uso.',
        },
      },
      400,
    )

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r.ok === false && r.erro.mensagem).toBe('Esse nome já está em uso.')
  })

  it('recusa um 200 sem id, que gravaria template sem a chave de tudo', async () => {
    responder({ status: 'PENDING' })

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r.ok).toBe(false)
  })

  it('vira erro quando a rede cai, em vez de derrubar quem chamou', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede caiu')))

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r).toEqual({ ok: false, erro: { codigo: null, mensagem: 'rede caiu' } })
  })

  it('diz que foi prazo quando o prazo estoura', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout))

    const r = await criarTemplateNaMeta({ ...BASE, componentes: { corpo: 'oi' } })

    expect(r.ok === false && r.erro.mensagem).toMatch(/não respondeu em 20s/)
  })
})

describe('listar templates da Meta (a reconciliação)', () => {
  it('pede os campos explicitamente — sem isso não vem qualidade nem recusa', async () => {
    const fetchMock = responder({ data: [] })

    await listarTemplatesDaMeta({ wabaId: 'waba-1', token: 't', versaoGraph: 'v25.0' })

    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('quality_score')
    expect(url).toContain('rejected_reason')
  })

  it('traduz cada linha, incluindo a nota de qualidade aninhada', async () => {
    responder({
      data: [
        {
          id: '1',
          name: 'lembrete',
          language: 'pt_BR',
          status: 'APPROVED',
          category: 'UTILITY',
          quality_score: { score: 'GREEN' },
        },
      ],
    })

    const r = await listarTemplatesDaMeta({ wabaId: 'waba-1', token: 't' })

    expect(r.ok && r.templates[0]).toEqual({
      wabaTemplateId: '1',
      nome: 'lembrete',
      idioma: 'pt_BR',
      status: 'aprovado',
      categoria: 'UTILITY',
      qualidade: 'GREEN',
      motivoRecusa: null,
    })
  })

  it('descarta linha sem id ou sem nome, que não casa com nada nosso', async () => {
    responder({ data: [{ name: 'sem id' }, { id: '2' }, { id: '3', name: 'boa' }] })

    const r = await listarTemplatesDaMeta({ wabaId: 'waba-1', token: 't' })

    expect(r.ok && r.templates.map((t) => t.nome)).toEqual(['boa'])
  })

  it('devolve lista vazia quando a Meta não manda `data`', async () => {
    responder({})

    const r = await listarTemplatesDaMeta({ wabaId: 'waba-1', token: 't' })

    expect(r).toEqual({ ok: true, templates: [] })
  })

  it('leva o erro adiante em vez de fingir lista vazia', async () => {
    responder({ error: { code: 190, message: 'token expirou' } }, 401)

    const r = await listarTemplatesDaMeta({ wabaId: 'waba-1', token: 't' })

    // Lista vazia aqui faria a reconciliação concluir "o cliente não tem
    // template nenhum" e apagar tudo.
    expect(r).toEqual({ ok: false, erro: { codigo: 190, mensagem: 'token expirou' } })
  })
})

describe('apagar template na Meta', () => {
  it('manda DELETE com o nome na query', async () => {
    const fetchMock = responder({ success: true })

    await apagarTemplateNaMeta({ wabaId: 'waba-1', token: 't', nome: 'velho', versaoGraph: 'v25.0' })

    const [url, opcoes] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(
      'https://graph.facebook.com/v25.0/waba-1/message_templates?name=velho',
    )
    expect(opcoes.method).toBe('DELETE')
  })

  it('leva o erro da Meta adiante', async () => {
    responder({ error: { code: 100, message: 'not found' } }, 404)

    const r = await apagarTemplateNaMeta({ wabaId: 'waba-1', token: 't', nome: 'sumiu' })

    expect(r.ok).toBe(false)
  })
})
