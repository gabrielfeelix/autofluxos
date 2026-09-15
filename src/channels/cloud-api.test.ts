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

})

/*
 * -----------------------------------------------------------------------------
 * Subir antes, mandar por `id`
 * -----------------------------------------------------------------------------
 *
 * O envio mandava `link`, e `link` obriga o arquivo a estar num endereço que a
 * **Meta** alcança sem credencial nossa — que é a razão de o `autofluxos-acervo`
 * ser público e permanente (item 2 do handoff de 15/set).
 *
 * Subindo antes, o endereço de origem só precisa ser alcançável por nós. Estes
 * testes travam as duas metades: que o `id` é usado quando o upload dá certo, e
 * que o `link` volta sozinho quando não dá. A segunda é a que permite esta
 * mudança ter ido ao ar sem um teste em WhatsApp de verdade — o pior caso dela
 * é o comportamento de ontem.
 */
describe('enviar mídia sobe o arquivo antes', () => {
  function canal() {
    return canalCloudApi({
      phoneNumberId: 'numero-1',
      token: 'token-de-teste',
      versaoGraph: 'v25.0',
    })
  }

  /** GET do arquivo → POST /media → POST /messages. */
  function espiarEnvioDeMidia(idDaMidia: string | null = 'media-id-1') {
    const fetchMock = vi.fn(async (endereco: string) => {
      if (typeof endereco === 'string' && endereco.startsWith('https://exemplo/')) {
        return new Response('conteudo-do-arquivo', {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      }
      if (typeof endereco === 'string' && endereco.endsWith('/media')) {
        return idDaMidia === null
          ? new Response('sem espaço', { status: 500 })
          : new Response(JSON.stringify({ id: idDaMidia }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock as unknown as ReturnType<typeof vi.fn>
  }

  function corpo(fetchMock: ReturnType<typeof vi.fn>, chamada: number) {
    return JSON.parse(fetchMock.mock.calls[chamada]![1].body as string)
  }

  it('sobe o arquivo e manda o `id`, sem `link` nenhum no corpo', async () => {
    const fetchMock = espiarEnvioDeMidia()
    await canal().enviarMidia('5544999', { midia: 'imagem', url: 'https://exemplo/foto.png' })

    expect(fetchMock.mock.calls[0]![0]).toBe('https://exemplo/foto.png')
    expect(fetchMock.mock.calls[1]![0]).toBe('https://graph.facebook.com/v25.0/numero-1/media')

    const enviado = corpo(fetchMock, 2)
    expect(enviado.image).toEqual({ id: 'media-id-1' })
    expect(enviado.image).not.toHaveProperty('link')
  })

  it('o upload leva `messaging_product` e o arquivo com o tipo da origem', async () => {
    const fetchMock = espiarEnvioDeMidia()
    await canal().enviarMidia('5544999', { midia: 'imagem', url: 'https://exemplo/foto.png' })

    const pedido = fetchMock.mock.calls[1]![1] as { body: FormData; headers: Record<string, string> }
    expect(pedido.body.get('messaging_product')).toBe('whatsapp')

    const arquivo = pedido.body.get('file') as File
    expect(arquivo.type).toBe('image/png')
    expect(arquivo.name).toBe('foto.png')

    /*
     * Escrever `content-type` à mão apaga o `boundary` que o fetch monta
     * sozinho, e o multipart sai malformado — a Meta responde 400 sem dizer
     * por quê. É um erro de trinta segundos que custa uma tarde.
     */
    expect(Object.keys(pedido.headers).map((k) => k.toLowerCase())).not.toContain('content-type')
  })

  it('quando a Meta recusa o upload, o envio cai para o `link` de antes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = espiarEnvioDeMidia(null)
    await canal().enviarMidia('5544999', {
      midia: 'documento',
      url: 'https://exemplo/plano.pdf',
      nomeArquivo: 'plano.pdf',
    })

    const enviado = corpo(fetchMock, 2)
    expect(enviado.document).toEqual({ link: 'https://exemplo/plano.pdf', filename: 'plano.pdf' })
  })

  it('quando nem o arquivo desce, também cai para o `link`', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async (endereco: string) =>
      typeof endereco === 'string' && endereco.startsWith('https://exemplo/')
        ? new Response('sumiu', { status: 404 })
        : new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await canal().enviarMidia('5544999', { midia: 'audio', url: 'https://exemplo/voz.ogg' })

    const enviado = JSON.parse(
      (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![1].body as string,
    )
    expect(enviado.audio).toEqual({ link: 'https://exemplo/voz.ogg' })
  })

  it('mídia também cita, e a citação não invade o objeto da mídia', async () => {
    const fetchMock = espiarEnvioDeMidia()
    await canal().enviarMidia(
      '5544999',
      { midia: 'imagem', url: 'https://exemplo/tabela.png', legenda: 'a tabela' },
      'wamid-citada',
    )

    const enviado = corpo(fetchMock, 2)
    // `context` é irmão do `type`, não mora dentro do objeto da mídia.
    expect(enviado.context).toEqual({ message_id: 'wamid-citada' })
    expect(enviado.image).toEqual({ id: 'media-id-1', caption: 'a tabela' })
  })

  it('áudio continua sem legenda, venha por `id` ou por `link`', async () => {
    const fetchMock = espiarEnvioDeMidia()
    await canal().enviarMidia('5544999', {
      midia: 'audio',
      url: 'https://exemplo/voz.ogg',
      legenda: 'não pode',
    })

    expect(corpo(fetchMock, 2).audio).toEqual({ id: 'media-id-1' })
  })
})
