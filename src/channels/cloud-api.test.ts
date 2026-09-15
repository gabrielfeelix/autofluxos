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

describe('reagir e citar', () => {
  function canal() {
    return canalCloudApi({
      phoneNumberId: 'numero-1',
      token: 'token-de-teste',
      versaoGraph: 'v25.0',
    })
  }

  function espiar() {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  /** O corpo que saiu, já como objeto. */
  function corpo(fetchMock: ReturnType<typeof vi.fn>, chamada = 0) {
    return JSON.parse(fetchMock.mock.calls[chamada]![1].body as string)
  }

  it('manda a reação com o id da mensagem e o emoji', async () => {
    const fetchMock = espiar()
    await canal().reagir!('5544999', 'wamid-alvo', '❤️')

    expect(corpo(fetchMock)).toEqual({
      messaging_product: 'whatsapp',
      to: '5544999',
      type: 'reaction',
      reaction: { message_id: 'wamid-alvo', emoji: '❤️' },
    })
  })

  /*
   * O emoji vazio é como a Meta desfaz uma reação — não existe endpoint de
   * "desreagir". Se alguém "limpar" a string vazia por achá-la um bug, tirar a
   * reação para de funcionar e nada acusa.
   */
  it('emoji vazio remove a reação, e não vira envio sem emoji', async () => {
    const fetchMock = espiar()
    await canal().reagir!('5544999', 'wamid-alvo', '')

    expect(corpo(fetchMock).reaction).toEqual({ message_id: 'wamid-alvo', emoji: '' })
  })

  it('cita no nível de cima do corpo, irmão do type — não dentro do text', async () => {
    const fetchMock = espiar()
    await canal().enviarTexto('5544999', 'claro, pode ser terça', 'wamid-citada')

    const enviado = corpo(fetchMock)
    expect(enviado.context).toEqual({ message_id: 'wamid-citada' })
    expect(enviado.text).toEqual({ preview_url: true, body: 'claro, pode ser terça' })
  })

  it('sem citação, o corpo não ganha context nenhum', async () => {
    const fetchMock = espiar()
    await canal().enviarTexto('5544999', 'oi')

    expect(corpo(fetchMock)).not.toHaveProperty('context')
  })

  it('mídia também cita, e a citação não invade o objeto da mídia', async () => {
    const fetchMock = espiar()
    await canal().enviarMidia(
      '5544999',
      { midia: 'imagem', url: 'https://exemplo/tabela.png', legenda: 'a tabela' },
      'wamid-citada',
    )

    const enviado = corpo(fetchMock)
    expect(enviado.context).toEqual({ message_id: 'wamid-citada' })
    expect(enviado.image).toEqual({ link: 'https://exemplo/tabela.png', caption: 'a tabela' })
  })
})
