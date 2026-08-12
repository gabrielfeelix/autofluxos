import { afterEach, describe, expect, it, vi } from 'vitest'

const conferirEndereco = vi.hoisted(() => vi.fn())
vi.mock('./rede', () => ({ conferirEndereco }))

const { chamarHttp, extrair, CABECALHO_TESTE, TIMEOUT_MS } = await import('./http')
import type { PedidoHttp } from './http'

const pedido = (mudanca: Partial<PedidoHttp> = {}): PedidoHttp => ({
  tipo: 'chamar_http',
  metodo: 'GET',
  url: 'https://exemplo.com/pedido',
  cabecalhos: [],
  corpo: '',
  mapear: [],
  aoFalhar: 'humano',
  ...mudanca,
})

function fetchResponde(corpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

/** Lê o `init` da chamada de `fetch` que o teste espionou. */
function initDaChamada(espiao: ReturnType<typeof vi.fn>, i = 0): RequestInit {
  const chamada = espiao.mock.calls[i] as [string, RequestInit] | undefined
  if (!chamada) throw new Error('fetch não foi chamado')
  return chamada[1]
}

afterEach(() => {
  vi.restoreAllMocks()
  conferirEndereco.mockReset()
})

describe('extrair', () => {
  const dados = {
    pedido: { status: 'a caminho' },
    itens: [{ nome: 'Camisa' }],
    total: 42,
    pago: true,
    nada: null,
  }

  it('lê campo raso', () => expect(extrair(dados, 'total')).toBe('42'))
  it('lê caminho com ponto', () => expect(extrair(dados, 'pedido.status')).toBe('a caminho'))
  it('lê índice de lista', () => expect(extrair(dados, 'itens.0.nome')).toBe('Camisa'))
  it('booleano vira texto', () => expect(extrair(dados, 'pago')).toBe('true'))
  it('caminho que não existe vira vazio', () => expect(extrair(dados, 'nada.aqui')).toBe(''))
  it('null vira vazio', () => expect(extrair(dados, 'nada')).toBe(''))
  it('objeto inteiro vira JSON', () =>
    expect(extrair(dados, 'pedido')).toBe('{"status":"a caminho"}'))
})

describe('chamarHttp', () => {
  it('recusa antes de chamar quando o endereço é interno', async () => {
    conferirEndereco.mockResolvedValue({ ok: false, motivo: 'endereço interno' })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(espiao).not.toHaveBeenCalled()
  })

  it('mapeia a resposta nas variáveis pedidas', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde({ pedido: { status: 'a caminho' } }))

    const r = await chamarHttp(
      pedido({ mapear: [{ variavel: 'situacao', caminho: 'pedido.status' }] }),
      { deTeste: false },
    )

    expect(r).toEqual({ ok: true, valores: { situacao: 'a caminho' } })
  })

  it('sem mapear, não liga para o que voltou — é o webhook disparado e esquecido', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde('isto não é JSON'))

    expect(await chamarHttp(pedido(), { deTeste: false })).toEqual({ ok: true, valores: {} })
  })

  it('com mapear, resposta que não é JSON é falha', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde('isto não é JSON'))

    const r = await chamarHttp(pedido({ mapear: [{ variavel: 'x', caminho: 'a' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(false)
  })

  it('status fora de 2xx é falha, e o motivo diz qual', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde({ erro: 'ops' }, 500))

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('500')
  })

  it('POST manda o corpo e o content-type', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"a":1}' }), { deTeste: false })

    const init = initDaChamada(espiao)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('GET não manda corpo, mesmo se o bloco tiver um escrito', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'GET', corpo: '{"a":1}' }), { deTeste: false })

    expect(initDaChamada(espiao).body).toBeUndefined()
  })

  it('leva os cabeçalhos configurados no bloco', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'x-chave', valor: 'abc' }] }), {
      deTeste: false,
    })

    expect(new Headers(initDaChamada(espiao).headers).get('x-chave')).toBe('abc')
  })

  it('cabeçalho sem nome é ignorado em vez de estourar', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: '  ', valor: 'x' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(true)
  })

  it('marca o disparo vindo do simulador', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: true })

    expect(new Headers(initDaChamada(espiao).headers).get(CABECALHO_TESTE)).toBe('1')
  })

  it('não marca o disparo vindo do WhatsApp', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: false })

    expect(new Headers(initDaChamada(espiao).headers).get(CABECALHO_TESTE)).toBeNull()
  })

  it('rede que estoura vira falha com motivo, não exceção', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')))

    expect((await chamarHttp(pedido(), { deTeste: false })).ok).toBe(false)
  })

  it('timeout tem motivo próprio, com o tempo dito', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const estouro = Object.assign(new Error('The operation was aborted'), {
      name: 'TimeoutError',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(estouro))

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain(String(TIMEOUT_MS / 1000))
  })

  it('passa um sinal de abortar para o fetch', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: false })

    expect(initDaChamada(espiao).signal).toBeInstanceOf(AbortSignal)
  })

  it('não deixa o fetch seguir redirecionamento sozinho', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: false })

    expect(initDaChamada(espiao).redirect).toBe('manual')
  })

  it('redirecionamento passa pela mesma recusa de endereço', async () => {
    conferirEndereco
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, motivo: 'endereço interno' })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: 'https://interno.local/' } }),
        ),
    )

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(conferirEndereco).toHaveBeenCalledTimes(2)
    expect(conferirEndereco).toHaveBeenLastCalledWith('https://interno.local/')
  })

  it('redirecionamento para endereço bom é seguido', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/depois' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 'b' }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    const r = await chamarHttp(pedido({ mapear: [{ variavel: 'v', caminho: 'a' }] }), {
      deTeste: false,
    })

    expect(r).toEqual({ ok: true, valores: { v: 'b' } })
    // Local relativo é resolvido contra a URL anterior.
    expect(espiao.mock.calls[1]?.[0]).toBe('https://exemplo.com/depois')
  })

  it('corrente infinita de redirecionamento para em vez de rodar para sempre', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: 'https://a.com/volta' } }),
        ),
    )

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('redirecionou')
  })

  it('redirecionamento sem location não é tratado como redirecionamento', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302 })))

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('302')
  })
})

describe('cabeçalho não pode derrubar a conversa nem vazar', () => {
  it('cabeçalho com nome inválido vira falha, não exceção solta', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = fetchResponde({})
    vi.stubGlobal('fetch', espiao)

    // Espaço no nome faz `Headers.set` lançar. Sem o try, isso escaparia até o
    // after() do webhook e a pessoa ficaria sem resposta nenhuma.
    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: 'x chave', valor: 'a' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('cabeçalho')
  })

  it('cabeçalho com valor inválido também vira falha', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchResponde({}))

    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: 'x-a', valor: 'quebra\nlinha' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(false)
  })

  it('redirecionamento para OUTRO host não leva os cabeçalhos configurados', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://outro.com/x' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'authorization', valor: 'Bearer segredo' }] }), {
      deTeste: false,
    })

    expect(new Headers(initDaChamada(espiao, 0).headers).get('authorization')).toBe('Bearer segredo')
    expect(new Headers(initDaChamada(espiao, 1).headers).get('authorization')).toBeNull()
  })

  it('redirecionamento para o MESMO host mantém os cabeçalhos', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/outro-caminho' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'authorization', valor: 'Bearer segredo' }] }), {
      deTeste: false,
    })

    expect(new Headers(initDaChamada(espiao, 1).headers).get('authorization')).toBe('Bearer segredo')
  })
})

describe('o corpo não acompanha redirecionamento para fora', () => {
  it('302 para outro host não leva o corpo, e vira GET', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://outro.com/x' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(initDaChamada(espiao, 0).body).toBe('{"lead":"João"}')
    expect(initDaChamada(espiao, 1).body).toBeUndefined()
    expect(initDaChamada(espiao, 1).method).toBe('GET')
  })

  it('307 para outro host preserva o método mas larga o corpo', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { location: 'https://outro.com/x' } }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(initDaChamada(espiao, 1).method).toBe('POST')
    expect(initDaChamada(espiao, 1).body).toBeUndefined()
  })

  it('307 no MESMO host mantém método e corpo', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: '/outro' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ a: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(initDaChamada(espiao, 1).method).toBe('POST')
    expect(initDaChamada(espiao, 1).body).toBe('{"lead":"João"}')
  })

  it('segue no máximo 3 redirecionamentos — 4 chamadas ao todo', async () => {
    conferirEndereco.mockResolvedValue({ ok: true })
    const espiao = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://exemplo.com/volta' } }),
      )
    vi.stubGlobal('fetch', espiao)

    await chamarHttp(pedido(), { deTeste: false })

    // Importa para o orçamento de tempo: 4 x TIMEOUT_MS tem que caber no
    // maxDuration que o webhook declara.
    expect(espiao).toHaveBeenCalledTimes(4)
  })
})

describe('valor mapeado tem teto', () => {
  it('corta valor gigante em vez de deixar estourar o limite do WhatsApp', () => {
    const enorme = { texto: 'a'.repeat(5000) }
    const valor = extrair(enorme, 'texto')

    expect(valor.length).toBeLessThan(1100)
    expect(valor.endsWith('…')).toBe(true)
  })

  it('objeto grande também é cortado', () => {
    const valor = extrair({ lista: Array.from({ length: 500 }, (_, i) => ({ i })) }, 'lista')
    expect(valor.length).toBeLessThan(1100)
  })
})
