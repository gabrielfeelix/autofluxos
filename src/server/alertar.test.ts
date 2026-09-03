import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertar } from './alertar'
import { gravarAlerta } from './repos/alertas'

/*
 * O repositório é dublado porque o assunto aqui é o **aviso**, não a gravação.
 * `gravarAlerta` tem os testes dele; misturar os dois obrigaria todo teste de
 * texto de webhook a ter banco de pé.
 */
vi.mock('./repos/alertas', async (original) => ({
  ...(await original<typeof import('./repos/alertas')>()),
  gravarAlerta: vi.fn(async () => true),
}))

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

beforeEach(() => {
  vi.mocked(gravarAlerta).mockClear()
  // O `console.error` é de propósito (é a última linha de defesa quando o
  // banco é o que está fora), e encheria a saída de todo teste daqui.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('alertar', () => {
  it('sem URL configurada não chama webhook nenhum', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', '')
    const espiao = fingirFetch()

    await alertar('qualquer coisa', new Error('quebrou'))

    expect(espiao).not.toHaveBeenCalled()
  })

  /**
   * O defeito que este arquivo passou meses sem pegar: sem
   * `ALERTA_WEBHOOK_URL`, `alertar()` era no-op inteiro. O teste acima passava
   * — e provava exatamente a coisa errada, porque "não chamou o webhook" era
   * lido como "está tudo certo" quando na verdade nada acontecia.
   */
  it('sem URL configurada o alerta ainda é gravado', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', '')
    fingirFetch()

    await alertar('o cofre não devolveu a credencial', new Error('403'), { cliente: 'abc' })

    expect(gravarAlerta).toHaveBeenCalledWith({
      titulo: 'o cofre não devolveu a credencial',
      detalhe: expect.stringContaining('403'),
      contexto: { cliente: 'abc' },
    })
  })

  it('banco fora não vira exceção para quem chamou', async () => {
    vi.stubEnv('ALERTA_WEBHOOK_URL', '')
    vi.mocked(gravarAlerta).mockResolvedValueOnce(false)

    await expect(alertar('entrega', new Error('original'))).resolves.toBeUndefined()
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
