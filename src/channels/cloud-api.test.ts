import { afterEach, describe, expect, it, vi } from 'vitest'
import { canalCloudApi, enderecar } from './cloud-api'

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
   * "📅 Escolher outro dia" tem 20 CARACTERES, cabe no limite da Meta, mas
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
     * Nenhum substituto SOLTO, o que `.slice` deixaria aqui, e o que derruba a
     * gravação no Postgres. Um emoji inteiro tem dois substitutos pareados e é
     * legítimo; o defeito é a metade órfã.
     */
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(titulo)).toBe(
      false,
    )
  })
})

describe('a descrição da linha da lista', () => {
  it('vai como `description` na lista, e só em quem tem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const canal = canalCloudApi({ phoneNumberId: 'n1', token: 't', versaoGraph: 'v25.0' })

    await canal.enviarOpcoes(
      '5544999999999',
      'Qual pizza?',
      [
        { id: 'calabresa', rotulo: 'Calabresa', descricao: 'R$ 52,90 · calabresa, cebola e mussarela' },
        { id: 'voltar', rotulo: 'Voltar ao menu' },
      ],
      'lista',
    )

    const corpo = JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body as string)
    expect(corpo.interactive.action.sections[0].rows).toEqual([
      { id: 'calabresa', title: 'Calabresa', description: 'R$ 52,90 · calabresa, cebola e mussarela' },
      { id: 'voltar', title: 'Voltar ao menu' },
    ])
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
   * O emoji vazio é como a Meta desfaz uma reação, não existe endpoint de
   * "desreagir". Se alguém "limpar" a string vazia por achá-la um bug, tirar a
   * reação para de funcionar e nada acusa.
   */
  it('emoji vazio remove a reação, e não vira envio sem emoji', async () => {
    const fetchMock = espiar()
    await canal().reagir!('5544999', 'wamid-alvo', '')

    expect(corpo(fetchMock).reaction).toEqual({ message_id: 'wamid-alvo', emoji: '' })
  })

  it('cita no nível de cima do corpo, irmão do type, não dentro do text', async () => {
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
 * **Meta** alcança sem credencial nossa, que é a razão de o `autofluxos-acervo`
 * ser público e permanente (item 2 do handoff de 15/set).
 *
 * Subindo antes, o endereço de origem só precisa ser alcançável por nós. Estes
 * testes travam as duas metades: que o `id` é usado quando o upload dá certo, e
 * que o `link` volta sozinho quando não dá. A segunda é a que permite esta
 * mudança ter ido ao ar sem um teste em WhatsApp de verdade, o pior caso dela
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
     * sozinho, e o multipart sai malformado, a Meta responde 400 sem dizer
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

describe('o envio de template', () => {
  function canal() {
    return canalCloudApi({
      phoneNumberId: 'numero-1',
      token: 'token-de-teste',
      versaoGraph: 'v25.0',
    })
  }

  /** A resposta que a Meta dá num envio aceito. */
  function espiar(messageStatus = 'accepted', id = 'wamid-saida-1') {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ messages: [{ id, message_status: messageStatus }] }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function corpo(fetchMock: ReturnType<typeof vi.fn>, chamada = 0) {
    return JSON.parse(fetchMock.mock.calls[chamada]![1].body as string)
  }

  it('manda nome e idioma, e nenhum componente quando não há variável', async () => {
    const fetchMock = espiar()
    await canal().enviarTemplate!('5544999', { nome: 'lembrete', idioma: 'pt_BR' })

    // `components` ausente e não `[]`: array vazio faz a Meta recusar com
    // 132000, mesmo o template não tendo lacuna nenhuma.
    expect(corpo(fetchMock)).toEqual({
      messaging_product: 'whatsapp',
      to: '5544999',
      type: 'template',
      template: { name: 'lembrete', language: { code: 'pt_BR' } },
    })
  })

  it('separa os valores do cabeçalho dos do corpo, na ordem em que vieram', async () => {
    const fetchMock = espiar()
    await canal().enviarTemplate!('5544999', {
      nome: 'lembrete',
      idioma: 'pt_BR',
      valores: { cabecalho: ['Consulta'], corpo: ['Ana', '15/10', '14h'] },
    })

    // Cabeçalho e corpo são numerados separadamente pela Meta: o {{1}} de um
    // não é o {{1}} do outro.
    expect(corpo(fetchMock).template.components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Consulta' }] },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ana' },
          { type: 'text', text: '15/10' },
          { type: 'text', text: '14h' },
        ],
      },
    ])
  })

  it('omite o cabeçalho quando só o corpo tem variável', async () => {
    const fetchMock = espiar()
    await canal().enviarTemplate!('5544999', {
      nome: 'lembrete',
      idioma: 'pt_BR',
      valores: { corpo: ['Ana'] },
    })

    const componentes = corpo(fetchMock).template.components
    expect(componentes).toHaveLength(1)
    expect(componentes[0].type).toBe('body')
  })

  it('devolve o wamid e a situação que a Meta informou', async () => {
    espiar('accepted', 'wamid-real')
    const envio = await canal().enviarTemplate!('5544999', {
      nome: 'lembrete',
      idioma: 'pt_BR',
    })

    expect(envio).toEqual({ wamid: 'wamid-real', situacao: 'aceita' })
  })

  /*
   * A armadilha que este arquivo inteiro existe para não cair: 200 com
   * `held_for_quality_assessment` NÃO é entrega. A Meta segurou a mensagem, e
   * se o veredito for ruim ela é descartada e chega depois como `failed` 132015.
   */
  it('não confunde mensagem retida com aceita, mesmo a Meta respondendo 200', async () => {
    espiar('held_for_quality_assessment')
    const envio = await canal().enviarTemplate!('5544999', {
      nome: 'novo_em_folha',
      idioma: 'pt_BR',
    })

    expect(envio.situacao).toBe('retida')
  })

  it('trata `paused` como falha, porque a mensagem não vai sair', async () => {
    espiar('paused')
    const envio = await canal().enviarTemplate!('5544999', {
      nome: 'pausado',
      idioma: 'pt_BR',
    })

    expect(envio.situacao).toBe('falhou')
  })

  it('não desfaz um envio que já aconteceu quando o corpo do 200 é ilegível', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('isto não é json', { status: 200 })),
    )

    // A mensagem saiu. Sem wamid perdemos o rastreio do status, não a entrega.
    const envio = await canal().enviarTemplate!('5544999', {
      nome: 'lembrete',
      idioma: 'pt_BR',
    })

    expect(envio).toEqual({ wamid: '', situacao: 'aceita' })
  })

  it('estoura quando a Meta recusa, com o motivo dela no erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":{"code":132001,"message":"template does not exist"}}', {
          status: 400,
        }),
      ),
    )

    await expect(
      canal().enviarTemplate!('5544999', { nome: 'sumiu', idioma: 'pt_BR' }),
    ).rejects.toThrow(/132001/)
  })
})

describe('card do produto na Cloud API', () => {
  const produto = {
    produtoId: '330107',
    nome: 'Headset PCYES Comfort CM500',
    preco: 95.92,
    precoDe: 119.9,
    emEstoque: true,
    foto: 'https://www.pcyes.com.br/media/catalog/product/c/m/cm500.jpg',
    link: 'https://www.pcyes.com.br/headset-comfort-cm500',
  }

  it('manda cta_url com a foto no cabeçalho e o botão Ver na loja', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const canal = canalCloudApi({ phoneNumberId: 'numero-1', token: 'token-de-teste', versaoGraph: 'v25.0' })

    await canal.enviarProdutos!('5544999', [
      produto,
      { ...produto, produtoId: 'sem-foto', foto: undefined },
      // Sem link não há botão: o cta_url exige url, e a Meta recusaria.
      { ...produto, produtoId: 'sem-link', link: '' },
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      messaging_product: 'whatsapp',
      to: '5544999',
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        header: { type: 'image', image: { link: produto.foto } },
        body: { text: '*Headset PCYES Comfort CM500*\nde ~R$ 119,90~ por *R$ 95,92*, em estoque' },
        action: { name: 'cta_url', parameters: { display_text: 'Ver na loja', url: produto.link } },
      },
    })
    // Sem foto o card sai igual, só sem cabeçalho: em texto, o link de
    // rastreio aparece inteiro na conversa (PCYES, 25/set/2026).
    const semFoto = JSON.parse(fetchMock.mock.calls[1]![1].body)
    expect(semFoto.interactive.header).toBeUndefined()
    expect(semFoto.interactive.action.parameters.url).toBe(produto.link)
  })
})

describe('envio para contato sem telefone (BSUID)', () => {
  it('troca `to` por `recipient` quando o destino é BSUID', () => {
    expect(enderecar({ to: 'BR.13491208655302741918', type: 'text' })).toEqual({
      recipient: 'BR.13491208655302741918',
      type: 'text',
    })
  })

  it('telefone continua em `to`', () => {
    const corpo = { to: '5511987654321', type: 'text' }
    expect(enderecar(corpo)).toBe(corpo)
  })
})
