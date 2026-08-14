import { afterEach, describe, expect, it, vi } from 'vitest'
import { alertar } from './alertar'

const URL_FALSA = 'https://discord.example/webhooks/teste'

function fingirFetch(implementacao?: (url: string, init: RequestInit) => Promise<Response>) {
  const espiao = vi.fn(implementacao ?? (async () => new Response('ok', { status: 200 })))
  vi.stubGlobal('fetch', espiao)
  return espiao
}

function corpoDe(espiao: ReturnType<typeof fingirFetch>): string {
  const [, init] = espiao.mock.calls[0] as [string, RequestInit]
  return (JSON.parse(String(init.body)) as { content: string }).content
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('alertar', () => {
  it('sem URL configurada não chama ninguém', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', '')
    const espiao = fingirFetch()

    await alertar('qualquer coisa', new Error('quebrou'))

    expect(espiao).not.toHaveBeenCalled()
  })

  it('manda o motivo e o contexto para o webhook', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', URL_FALSA)
    const espiao = fingirFetch()

    await alertar('a Cloud API recusou a entrega', new Error('token expirado'), {
      contato: 'abc-123',
      vazio: '',
      ausente: undefined,
    })

    expect(espiao).toHaveBeenCalledTimes(1)
    const [url, init] = espiao.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(URL_FALSA)
    expect(init.method).toBe('POST')

    const conteudo = corpoDe(espiao)
    expect(conteudo).toContain('a Cloud API recusou a entrega')
    expect(conteudo).toContain('token expirado')
    expect(conteudo).toContain('contato: abc-123')
    // Campo vazio não vira linha: contexto pela metade suja o aviso que a
    // pessoa vai ler às pressas.
    expect(conteudo).not.toContain('vazio:')
    expect(conteudo).not.toContain('ausente:')
  })

  it('descreve detalhe que não é Error sem virar [object Object]', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', URL_FALSA)
    const espiao = fingirFetch()

    await alertar('falha estranha', { status: 502, corpo: 'bad gateway' })

    expect(corpoDe(espiao)).toContain('bad gateway')
  })

  /**
   * O ponto do bloco inteiro: os três lugares que chamam `alertar()` já estão
   * num caminho de falha. Se o aviso estourar, a segunda falha derruba o que a
   * primeira ainda deixava de pé.
   */
  it('webhook fora do ar não vira exceção para quem chamou', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', URL_FALSA)
    fingirFetch(async () => {
      throw new Error('conexão recusada')
    })

    await expect(alertar('entrega', new Error('original'))).resolves.toBeUndefined()
  })

  it('corta o texto no limite que o Discord aceita', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', URL_FALSA)
    const espiao = fingirFetch()

    await alertar('gigante', 'x'.repeat(5_000))

    expect(corpoDe(espiao).length).toBeLessThanOrEqual(1_800)
  })
})
