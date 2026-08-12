import { afterEach, describe, expect, it, vi } from 'vitest'

const conferirEndereco = vi.hoisted(() => vi.fn())
vi.mock('./rede', () => ({ conferirEndereco }))

const pedirUndici = vi.hoisted(() => vi.fn())
const AgentFalso = vi.hoisted(() =>
  vi.fn(function (this: Record<string, unknown>, opcoes: unknown) {
    this.opcoes = opcoes
  }),
)
vi.mock('undici', () => ({ request: pedirUndici, Agent: AgentFalso }))

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

/** Uma resposta no formato que o `request` do undici devolve. */
function resposta(corpo: unknown, statusCode = 200, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers,
    body: {
      json: async () => (typeof corpo === 'string' ? (JSON.parse(corpo) as unknown) : corpo),
      dump: async () => undefined,
    },
  }
}

const responde = (corpo: unknown, statusCode = 200, headers: Record<string, string> = {}) =>
  pedirUndici.mockResolvedValue(resposta(corpo, statusCode, headers))

function opcoesDaChamada(i = 0) {
  const chamada = pedirUndici.mock.calls[i] as [string, Record<string, unknown>] | undefined
  if (!chamada) throw new Error('request não foi chamado')
  return chamada[1]
}

const urlDaChamada = (i = 0) => (pedirUndici.mock.calls[i] as [string, unknown])[0]
const cabecalhosDa = (i = 0) => opcoesDaChamada(i).headers as Record<string, string>

/** O `lookup` que o Agent recebeu na chamada `i`, já embrulhado em promessa. */
function lookupDo(i = 0, opcoes: { all?: boolean } = {}) {
  const construido = AgentFalso.mock.calls[i]?.[0] as {
    connect: { lookup: (h: string, o: object, cb: unknown) => void }
  }
  return new Promise((resolver) => {
    construido.connect.lookup(
      'qualquer.com',
      opcoes,
      (_e: unknown, a: unknown, b: unknown) => resolver(opcoes.all ? a : { endereco: a, familia: b }),
    )
  })
}

const aprovado = { ok: true, endereco: '93.184.216.34', familia: 4 }

afterEach(() => {
  pedirUndici.mockReset()
  AgentFalso.mockClear()
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

  it('corta valor gigante em vez de estourar o limite do WhatsApp', () => {
    const valor = extrair({ texto: 'a'.repeat(5000) }, 'texto')
    expect(valor.length).toBeLessThan(1100)
    expect(valor.endsWith('…')).toBe(true)
  })

  it('objeto grande também é cortado', () => {
    expect(extrair({ l: Array.from({ length: 500 }, (_, i) => ({ i })) }, 'l').length).toBeLessThan(
      1100,
    )
  })
})

describe('a conexão é fixada no endereço aprovado', () => {
  it('o dispatcher resolve para o IP validado, sem consultar DNS', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: false })

    // É este `lookup` que fecha o rebinding: sem ele, o undici resolveria o
    // nome de novo ao conectar e o atacante trocaria a resposta no meio.
    expect(await lookupDo(0)).toEqual({ endereco: '93.184.216.34', familia: 4 })
  })

  it('o lookup também atende a forma `all`, que o undici pode pedir', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: false })

    expect(await lookupDo(0, { all: true })).toEqual([{ address: '93.184.216.34', family: 4 }])
  })

  it('a URL entregue ao undici mantém o hostname — é o que faz o TLS bater', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: false })

    // Trocar o hostname pelo IP na própria URL quebraria a validação do
    // certificado. Quem mente é só o `lookup`.
    expect(urlDaChamada(0)).toBe('https://exemplo.com/pedido')
  })

  it('cada salto de redirecionamento fixa de novo', async () => {
    conferirEndereco
      .mockResolvedValueOnce(aprovado)
      .mockResolvedValueOnce({ ok: true, endereco: '1.2.3.4', familia: 4 })
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 302, { location: 'https://outro.com/x' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido(), { deTeste: false })

    expect(AgentFalso).toHaveBeenCalledTimes(2)
    expect(await lookupDo(1)).toEqual({ endereco: '1.2.3.4', familia: 4 })
  })
})

describe('chamarHttp', () => {
  it('recusa antes de chamar quando o endereço é interno', async () => {
    conferirEndereco.mockResolvedValue({ ok: false, motivo: 'endereço interno' })
    responde({})

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(pedirUndici).not.toHaveBeenCalled()
  })

  it('mapeia a resposta nas variáveis pedidas', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({ pedido: { status: 'a caminho' } })

    const r = await chamarHttp(
      pedido({ mapear: [{ variavel: 'situacao', caminho: 'pedido.status' }] }),
      { deTeste: false },
    )

    expect(r).toEqual({ ok: true, valores: { situacao: 'a caminho' } })
  })

  it('sem mapear, não liga para o que voltou — é o webhook disparado e esquecido', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde('isto não é JSON')

    expect(await chamarHttp(pedido(), { deTeste: false })).toEqual({ ok: true, valores: {} })
  })

  it('sem mapear, o corpo é descartado — deixar pendurado segura a conexão', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    const descartar = vi.fn(async () => undefined)
    pedirUndici.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { json: async () => ({}), dump: descartar },
    })

    await chamarHttp(pedido(), { deTeste: false })

    expect(descartar).toHaveBeenCalled()
  })

  it('com mapear, resposta que não é JSON é falha', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: {
        json: async () => {
          throw new Error('não é JSON')
        },
        dump: async () => undefined,
      },
    })

    const r = await chamarHttp(pedido({ mapear: [{ variavel: 'x', caminho: 'a' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(false)
  })

  it('status fora de 2xx é falha, e o motivo diz qual', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({ erro: 'ops' }, 500)

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('500')
  })

  it('POST manda o corpo e o content-type', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"a":1}' }), { deTeste: false })

    expect(opcoesDaChamada().method).toBe('POST')
    expect(opcoesDaChamada().body).toBe('{"a":1}')
    expect(cabecalhosDa()['content-type']).toBe('application/json')
  })

  it('GET não manda corpo, mesmo se o bloco tiver um escrito', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido({ metodo: 'GET', corpo: '{"a":1}' }), { deTeste: false })

    expect(opcoesDaChamada().body).toBeUndefined()
  })

  it('leva os cabeçalhos configurados no bloco', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'x-chave', valor: 'abc' }] }), {
      deTeste: false,
    })

    expect(cabecalhosDa()['x-chave']).toBe('abc')
  })

  it('cabeçalho sem nome é ignorado em vez de estourar', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: '  ', valor: 'x' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(true)
  })

  it('marca o disparo vindo do simulador', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: true })

    expect(cabecalhosDa()[CABECALHO_TESTE.toLowerCase()]).toBe('1')
  })

  it('não marca o disparo vindo do WhatsApp', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: false })

    expect(cabecalhosDa()[CABECALHO_TESTE.toLowerCase()]).toBeUndefined()
  })

  it('rede que estoura vira falha com motivo, não exceção', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici.mockRejectedValue(new Error('socket hang up'))

    expect((await chamarHttp(pedido(), { deTeste: false })).ok).toBe(false)
  })

  it.each([['HeadersTimeoutError'], ['BodyTimeoutError']])(
    '%s tem motivo próprio, com o tempo dito',
    async (nome) => {
      conferirEndereco.mockResolvedValue(aprovado)
      pedirUndici.mockRejectedValue(Object.assign(new Error('abortado'), { name: nome }))

      const r = await chamarHttp(pedido(), { deTeste: false })

      if (r.ok) throw new Error('deveria ter falhado')
      expect(r.motivo).toContain(String(TIMEOUT_MS / 1000))
    },
  )

  it('os dois tempos limite são passados ao undici', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    await chamarHttp(pedido(), { deTeste: false })

    expect(opcoesDaChamada().headersTimeout).toBe(TIMEOUT_MS)
    expect(opcoesDaChamada().bodyTimeout).toBe(TIMEOUT_MS)
  })
})

describe('redirecionamento', () => {
  it('passa pela mesma recusa de endereço', async () => {
    conferirEndereco
      .mockResolvedValueOnce(aprovado)
      .mockResolvedValueOnce({ ok: false, motivo: 'endereço interno' })
    responde(null, 302, { location: 'https://interno.local/' })

    const r = await chamarHttp(pedido(), { deTeste: false })

    expect(r.ok).toBe(false)
    expect(conferirEndereco).toHaveBeenCalledTimes(2)
    expect(conferirEndereco).toHaveBeenLastCalledWith('https://interno.local/')
  })

  it('para endereço bom é seguido, resolvendo local relativo', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 302, { location: '/depois' }))
      .mockResolvedValueOnce(resposta({ a: 'b' }))

    const r = await chamarHttp(pedido({ mapear: [{ variavel: 'v', caminho: 'a' }] }), {
      deTeste: false,
    })

    expect(r).toEqual({ ok: true, valores: { v: 'b' } })
    expect(urlDaChamada(1)).toBe('https://exemplo.com/depois')
  })

  it('segue no máximo 3 — 4 chamadas ao todo', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde(null, 302, { location: 'https://exemplo.com/volta' })

    const r = await chamarHttp(pedido(), { deTeste: false })

    // Importa para o orçamento de tempo: 4 x TIMEOUT_MS tem que caber no
    // maxDuration que o webhook declara.
    expect(pedirUndici).toHaveBeenCalledTimes(4)
    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('redirecionou')
  })

  it('sem location não é tratado como redirecionamento', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde(null, 302)

    const r = await chamarHttp(pedido(), { deTeste: false })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('302')
  })
})

describe('cabeçalho e corpo não vazam num redirecionamento para fora', () => {
  it('cabeçalho configurado fica para trás quando o host muda', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 302, { location: 'https://outro.com/x' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'authorization', valor: 'Bearer segredo' }] }), {
      deTeste: false,
    })

    expect(cabecalhosDa(0).authorization).toBe('Bearer segredo')
    expect(cabecalhosDa(1).authorization).toBeUndefined()
  })

  it('cabeçalho continua quando o redirecionamento é no mesmo host', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 302, { location: '/outro-caminho' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido({ cabecalhos: [{ chave: 'authorization', valor: 'Bearer segredo' }] }), {
      deTeste: false,
    })

    expect(cabecalhosDa(1).authorization).toBe('Bearer segredo')
  })

  it('302 para outro host não leva o corpo, e vira GET', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 302, { location: 'https://outro.com/x' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(opcoesDaChamada(0).body).toBe('{"lead":"João"}')
    expect(opcoesDaChamada(1).body).toBeUndefined()
    expect(opcoesDaChamada(1).method).toBe('GET')
  })

  it('307 para outro host preserva o método mas larga o corpo', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 307, { location: 'https://outro.com/x' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(opcoesDaChamada(1).method).toBe('POST')
    expect(opcoesDaChamada(1).body).toBeUndefined()
  })

  it('307 no mesmo host mantém método e corpo', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    pedirUndici
      .mockResolvedValueOnce(resposta(null, 307, { location: '/outro' }))
      .mockResolvedValueOnce(resposta({ a: 1 }))

    await chamarHttp(pedido({ metodo: 'POST', corpo: '{"lead":"João"}' }), { deTeste: false })

    expect(opcoesDaChamada(1).method).toBe('POST')
    expect(opcoesDaChamada(1).body).toBe('{"lead":"João"}')
  })
})

describe('cabeçalho inválido não derruba a conversa', () => {
  it('nome inválido vira falha, não exceção solta', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: 'x chave', valor: 'a' }] }), {
      deTeste: false,
    })

    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.motivo).toContain('cabeçalho')
  })

  it('valor inválido também vira falha', async () => {
    conferirEndereco.mockResolvedValue(aprovado)
    responde({})

    const r = await chamarHttp(pedido({ cabecalhos: [{ chave: 'x-a', valor: 'quebra\nlinha' }] }), {
      deTeste: false,
    })

    expect(r.ok).toBe(false)
  })
})
