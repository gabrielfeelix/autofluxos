import { afterEach, describe, expect, it, vi } from 'vitest'
import { canalCloudApi } from './cloud-api'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('indicador de digitação da Cloud API', () => {
  it('marca a mensagem recebida como lida, mostra digitando e espera', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const canal = canalCloudApi({
      phoneNumberId: 'numero-1',
      token: 'token-de-teste',
      versaoGraph: 'v25.0',
    })

    const espera = canal.aguardarResposta(
      { mensagemId: 'wamid-entrada-1', contato: '5544999' },
      1_000,
    )
    await vi.runAllTimersAsync()
    await espera

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/numero-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wamid-entrada-1',
          typing_indicator: { type: 'text' },
        }),
      }),
    )
  })

  it('mantém a espera quando o indicador falha, porque ele é só conveniência', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede caiu')))
    const canal = canalCloudApi({
      phoneNumberId: 'numero-1',
      token: 'token-de-teste',
      versaoGraph: 'v25.0',
    })
    let terminou = false

    const espera = canal
      .aguardarResposta({ mensagemId: 'wamid-entrada-2', contato: '5544999' }, 1_000)
      .then(() => {
        terminou = true
      })
    await vi.advanceTimersByTimeAsync(999)
    expect(terminou).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await espera
    expect(terminou).toBe(true)
  })
})

describe('o corte do rótulo conta caracteres, e não unidades UTF-16', () => {
  /*
   * "📅 Escolher outro dia" tem 20 CARACTERES — cabe no limite da Meta — mas
   * 21 unidades UTF-16, porque o emoji ocupa um par substituto. Com `.slice`,
   * o corte comia o "a" e o botão chegava escrito "Escolher outro di".
   *
   * Não era hipótese: saiu assim três vezes numa conversa real da MGM, e o
   * histórico guarda o clique com 19 caracteres.
   */
  it('não come a última letra de um rótulo que já cabia', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const canal = canalCloudApi({ phoneNumberId: 'n1', token: 't', versaoGraph: 'v25.0' })

    await canal.enviarOpcoes(
      '5544999999999',
      'E aí?',
      [
        { id: 'outro-dia', rotulo: '📅 Escolher outro dia' },
        { id: 'falar', rotulo: '💬 Chamar a recepção' },
      ],
      'botoes',
    )

    const corpo = JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body as string)
    const titulos = corpo.interactive.action.buttons.map(
      (b: { reply: { title: string } }) => b.reply.title,
    )
    expect(titulos).toEqual(['📅 Escolher outro dia', '💬 Chamar a recepção'])
  })

  it('rótulo que realmente estoura é cortado sem partir o emoji ao meio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const canal = canalCloudApi({ phoneNumberId: 'n1', token: 't', versaoGraph: 'v25.0' })

    await canal.enviarOpcoes(
      '5544999999999',
      'E aí?',
      // 20 caracteres antes do emoji: o corte cai EXATAMENTE em cima dele.
      [{ id: 'a', rotulo: 'vinte caracteres bem📅 e mais' }],
      'botoes',
    )

    const corpo = JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body as string)
    const titulo = corpo.interactive.action.buttons[0].reply.title as string
    expect([...titulo]).toHaveLength(20)
    expect(titulo).toBe('vinte caracteres bem')
    /*
     * Nenhum substituto SOLTO — o que `.slice` deixaria aqui, e o que derruba a
     * gravação no Postgres. Um emoji inteiro tem dois substitutos pareados e é
     * legítimo; o defeito é a metade órfã.
     */
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(titulo)).toBe(
      false,
    )
  })
})
