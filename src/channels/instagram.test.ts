import { afterEach, describe, expect, it, vi } from 'vitest'
import { canalInstagram } from './instagram'

function fingirFetch(implementacao?: () => Promise<Response>) {
  const espiao = vi.fn(implementacao ?? (async () => new Response('{}', { status: 200 })))
  vi.stubGlobal('fetch', espiao)
  return espiao
}

type Chamada = [string, RequestInit]

function chamadas(espiao: ReturnType<typeof fingirFetch>): Chamada[] {
  return espiao.mock.calls as unknown as Chamada[]
}

function corpos(espiao: ReturnType<typeof fingirFetch>): Record<string, unknown>[] {
  return chamadas(espiao).map(([, init]) => JSON.parse(String(init.body)))
}

const canal = () => canalInstagram({ igUserId: '178414', token: 'token-de-mentira' })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('o adaptador do Instagram', () => {
  it('fala com graph.instagram.com, e não com graph.facebook.com', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('igsid-do-contato', 'oi')

    const [url, init] = chamadas(espiao)[0]!
    // Host errado é o erro que responde 200 em teste e 400 em produção: as duas
    // APIs são parecidas o bastante para a confusão passar despercebida.
    expect(url).toBe('https://graph.instagram.com/v25.0/178414/messages')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-de-mentira')
    expect(corpos(espiao)[0]).toEqual({
      recipient: { id: 'igsid-do-contato' },
      message: { text: 'oi' },
    })
  })

  /**
   * `messaging_product: 'whatsapp'` é obrigatório na Cloud API e **não existe**
   * aqui. Copiar o adaptador do WhatsApp e esquecer de tirar esse campo é o
   * erro mais provável deste arquivo inteiro.
   */
  it('não manda o `messaging_product` da Cloud API', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('igsid', 'oi')

    expect(corpos(espiao)[0]).not.toHaveProperty('messaging_product')
  })

  it('as opções viram quick replies com o id da opção no payload', async () => {
    const espiao = fingirFetch()

    await canal().enviarOpcoes(
      'igsid',
      'Como podemos ajudar?',
      [
        { id: 'agendar', rotulo: 'Agendar aula' },
        { id: 'preco', rotulo: 'Ver preços' },
      ],
      'botoes',
    )

    expect(corpos(espiao)[0]).toEqual({
      recipient: { id: 'igsid' },
      message: {
        text: 'Como podemos ajudar?',
        quick_replies: [
          // O payload é o id, e não o rótulo: é por ele que o motor sabe qual
          // saída seguir quando a resposta voltar pelo webhook.
          { content_type: 'text', title: 'Agendar aula', payload: 'agendar' },
          { content_type: 'text', title: 'Ver preços', payload: 'preco' },
        ],
      },
    })
  })

  /**
   * O Instagram não tem lista. Pedir `formato: 'lista'` num fluxo de Instagram
   * não deveria acontecer — o canal é escolhido antes de desenhar —, mas uma
   * versão publicada antes dessa regra pode carregar o formato no grafo.
   */
  it('lista e botões saem iguais, porque só existe uma forma', async () => {
    const espiao = fingirFetch()
    const opcoes = [{ id: 'a', rotulo: 'A' }]

    await canal().enviarOpcoes('igsid', 'texto', opcoes, 'botoes')
    await canal().enviarOpcoes('igsid', 'texto', opcoes, 'lista')

    const [comoBotao, comoLista] = corpos(espiao)
    expect(comoBotao).toEqual(comoLista)
  })

  /**
   * Acima de 13 a Meta **recusa a mensagem inteira**, e não corta sozinha. Uma
   * lista truncada é ruim; uma pergunta que não chega no meio da conversa é
   * pior.
   */
  it('corta em 13 opções em vez de deixar a Meta recusar tudo', async () => {
    const espiao = fingirFetch()
    const muitas = Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, rotulo: `Opção ${i}` }))

    await canal().enviarOpcoes('igsid', 'texto', muitas, 'botoes')

    const { message } = corpos(espiao)[0] as { message: { quick_replies: unknown[] } }
    expect(message.quick_replies).toHaveLength(13)
  })

  it('corta o rótulo por caractere, sem partir emoji', async () => {
    const espiao = fingirFetch()

    await canal().enviarOpcoes(
      'igsid',
      'texto',
      [{ id: 'a', rotulo: '📅 Escolher outro dia da semana' }],
      'botoes',
    )

    const { message } = corpos(espiao)[0] as { message: { quick_replies: { title: string }[] } }
    const titulo = message.quick_replies[0]!.title
    expect([...titulo]).toHaveLength(20)
    // Meio par substituto vira `�` na hora de virar JSON — e o Postgres
    // recusa isso dentro de `jsonb` quando a mensagem é gravada.
    expect(titulo).not.toContain('�')
  })

  /**
   * O `attachment` do Instagram não tem campo de legenda. Ela vira mensagem
   * separada, e **antes** da mídia: foto sem contexto chegando primeiro é a
   * versão pior das duas.
   */
  it('a legenda vira uma mensagem própria, mandada antes da mídia', async () => {
    const espiao = fingirFetch()

    await canal().enviarMidia('igsid', {
      midia: 'imagem',
      url: 'https://exemplo.test/planta.jpg',
      legenda: 'A planta do estúdio',
    })

    expect(espiao).toHaveBeenCalledTimes(2)
    const [primeira, segunda] = corpos(espiao) as [
      { message: { text: string } },
      { message: { attachment: { type: string; payload: { url: string } } } },
    ]
    expect(primeira.message.text).toBe('A planta do estúdio')
    expect(segunda.message.attachment.type).toBe('image')
    expect(segunda.message.attachment.payload.url).toBe('https://exemplo.test/planta.jpg')
  })

  it('documento vira `file`, e não `document` como no WhatsApp', async () => {
    const espiao = fingirFetch()

    await canal().enviarMidia('igsid', { midia: 'documento', url: 'https://exemplo.test/x.pdf' })

    const { message } = corpos(espiao)[0] as { message: { attachment: { type: string } } }
    expect(message.attachment.type).toBe('file')
  })

  /**
   * O indicador do Instagram é `sender_action`, que quer saber com quem a
   * conversa é. Mandar o id da mensagem aqui — que é o que o WhatsApp exige —
   * faria a Meta responder 400 no meio de toda conversa com atraso.
   */
  it('o "digitando" usa o contato, e não o id da mensagem', async () => {
    const espiao = fingirFetch()

    await canal().aguardarResposta({ mensagemId: 'mid-abc', contato: 'igsid-do-contato' }, 0)

    const enviados = corpos(espiao) as {
      recipient: { id: string }
      sender_action: string
    }[]
    expect(enviados.map((e) => e.sender_action)).toEqual(['mark_seen', 'typing_on'])
    expect(enviados.every((e) => e.recipient.id === 'igsid-do-contato')).toBe(true)
  })

  it('indicador que falha não derruba a resposta', async () => {
    fingirFetch(async () => {
      throw new Error('rede caiu')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      canal().aguardarResposta({ mensagemId: 'mid', contato: 'igsid' }, 0),
    ).resolves.toBeUndefined()
  })

  it('erro da Meta vira mensagem com o texto dela dentro', async () => {
    fingirFetch(
      async () =>
        new Response('{"error":{"message":"This person isn\'t available right now"}}', {
          status: 400,
        }),
    )

    await expect(canal().enviarTexto('igsid', 'oi')).rejects.toThrow(
      /Instagram respondeu 400.*isn't available/,
    )
  })
})
