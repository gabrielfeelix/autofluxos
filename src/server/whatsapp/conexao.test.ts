import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O caso que este arquivo existe para nunca mais deixar passar:
 * **o cliente tem duas WABAs e o número está na segunda.**
 *
 * Em 13/set/2026 o Embedded Signup devolveu um `waba_id` na query, nós
 * confiamos nele, e o app foi inscrito numa WABA que não continha o número.
 * Webhook de WABA sem app inscrito não é entregue, sem erro, sem log, sem
 * nada. Nada entrou no Inbox daquele cliente, e os dois syncs de uso único
 * queimaram apontados para o lugar errado.
 *
 * Os testes usam os ids reais daquele dia de propósito: quem reabrir isto
 * daqui a seis meses acha o caso no histórico pelos números.
 */

process.env.META_APP_ID = '1063817842847269'
process.env.META_APP_SECRET = 'segredo-de-teste'

const fetchFalso = vi.fn()
vi.stubGlobal('fetch', fetchFalso)

const { wabaQueContemONumero } = await import('./conexao')

/** A WABA que o retorno do Embedded Signup apontou, e que não tem o número. */
const WABA_DO_RETORNO = '2042524849790437'
/** A WABA onde o número realmente vive. */
const WABA_CERTA = '101920619426215'
const NUMERO = '110549275215531'

function resposta(corpo: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(corpo),
    text: () => Promise.resolve(JSON.stringify(corpo)),
  } as Response)
}

function falha(status = 400, mensagem = 'sem permissão') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message: mensagem } }),
    text: () => Promise.resolve(JSON.stringify({ error: { message: mensagem } })),
  } as Response)
}

/** `debug_token` no formato que a Meta devolve, com as duas WABAs. */
function debugToken(...wabas: string[]) {
  return {
    data: {
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: wabas },
        { scope: 'whatsapp_business_messaging', target_ids: wabas },
      ],
    },
  }
}

function numeros(...ids: string[]) {
  return { data: ids.map((id) => ({ id, display_phone_number: '+55 11 91100-1414' })) }
}

beforeEach(() => {
  fetchFalso.mockReset()
})

describe('wabaQueContemONumero', () => {
  it('acha o número na segunda WABA quando a primeira não o tem', async () => {
    fetchFalso
      .mockImplementationOnce(() => resposta(debugToken(WABA_DO_RETORNO, WABA_CERTA)))
      // a WABA do retorno existe e responde, só não tem este número
      .mockImplementationOnce(() => resposta(numeros('999888777666555')))
      .mockImplementationOnce(() => resposta(numeros(NUMERO)))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBe(WABA_CERTA)
  })

  it('devolve a primeira quando é ela que contém o número', async () => {
    fetchFalso
      .mockImplementationOnce(() => resposta(debugToken(WABA_CERTA, WABA_DO_RETORNO)))
      .mockImplementationOnce(() => resposta(numeros(NUMERO)))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBe(WABA_CERTA)
    // Achou na primeira: não vai perguntar à segunda.
    expect(fetchFalso).toHaveBeenCalledTimes(2)
  })

  it('não desiste quando uma WABA do token é ilegível', async () => {
    fetchFalso
      .mockImplementationOnce(() => resposta(debugToken('conta-antiga', WABA_CERTA)))
      // Token sem permissão de leitura nesta: normal em cliente com contas velhas.
      .mockImplementationOnce(() => falha(403))
      .mockImplementationOnce(() => resposta(numeros(NUMERO)))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBe(WABA_CERTA)
  })

  it('devolve null quando nenhuma WABA contém o número, em vez de chutar', async () => {
    fetchFalso
      .mockImplementationOnce(() => resposta(debugToken(WABA_DO_RETORNO, WABA_CERTA)))
      .mockImplementationOnce(() => resposta(numeros('outro')))
      .mockImplementationOnce(() => resposta(numeros('mais-outro')))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBeNull()
  })

  it('devolve null quando o token não traz WABA nenhuma', async () => {
    fetchFalso.mockImplementationOnce(() => resposta(debugToken()))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBeNull()
  })

  it('devolve null, e não estoura, quando o debug_token falha', async () => {
    fetchFalso.mockImplementationOnce(() => falha(500))

    await expect(wabaQueContemONumero(NUMERO, 'token')).resolves.toBeNull()
  })
})
