import { describe, expect, it } from 'vitest'
import { paraMensagemInterna, webhookDoInstagramSchema } from './receber-do-instagram'

/**
 * A tradução do webhook do Instagram para a forma interna.
 *
 * Testada por aqui, e não pelo webhook inteiro, porque é onde moram as três
 * armadilhas do canal — eco, quick reply e a troca de `sender` com
 * `recipient`. Passar pelo webhook exigiria banco e esconderia qual delas
 * quebrou.
 */
describe('traduzir a mensagem do Instagram', () => {
  it('texto vira texto', () => {
    const m = paraMensagemInterna('igsid-contato', { mid: 'mid-1', text: 'quero agendar' })

    expect(m).toEqual({
      id: 'mid-1',
      from: 'igsid-contato',
      type: 'text',
      text: { body: 'quero agendar' },
    })
  })

  /**
   * A armadilha número um. A Meta devolve as **nossas próprias** mensagens no
   * mesmo webhook, com `is_echo`. Sem descartar, o bot lê o que ele mesmo
   * escreveu e responde a si mesmo — laço infinito com o cliente assistindo.
   */
  it('descarta o eco da nossa própria mensagem', () => {
    expect(
      paraMensagemInterna('igsid-contato', {
        mid: 'mid-2',
        text: 'Como podemos ajudar?',
        is_echo: true,
      }),
    ).toBeNull()
  })

  /**
   * A armadilha número dois. Quem toca num botão manda o rótulo como `text`
   * **e** o id como `quick_reply.payload`. Ler o texto primeiro transformaria
   * toda escolha de menu numa resposta escrita, e o motor perderia a saída.
   */
  it('o botão vence o texto que vem junto dele', () => {
    const m = paraMensagemInterna('igsid-contato', {
      mid: 'mid-3',
      text: 'Agendar aula',
      quick_reply: { payload: 'agendar' },
    })

    expect(m?.type).toBe('interactive')
    expect(m?.interactive?.button_reply?.id).toBe('agendar')
    // O rótulo continua indo junto: é ele que fica no histórico do lead, em vez
    // do id técnico que ninguém reconhece.
    expect(m?.interactive?.button_reply?.title).toBe('Agendar aula')
    expect(m?.text).toBeUndefined()
  })

  it('anexo de imagem vira mídia com a url como referência', () => {
    const m = paraMensagemInterna('igsid-contato', {
      mid: 'mid-4',
      attachments: [{ type: 'image', payload: { url: 'https://cdn.test/foto.jpg' } }],
    })

    expect(m?.type).toBe('image')
    expect(m?.image?.id).toBe('https://cdn.test/foto.jpg')
  })

  it('`file` do Instagram vira `document`, que é o nome interno', () => {
    const m = paraMensagemInterna('igsid-contato', {
      mid: 'mid-5',
      attachments: [{ type: 'file', payload: { url: 'https://cdn.test/x.pdf' } }],
    })

    expect(m?.type).toBe('document')
    expect(m?.document?.id).toBe('https://cdn.test/x.pdf')
  })

  /**
   * Menção em story e reel compartilhado não são arquivo que o fluxo saiba
   * tratar. Cair no caminho de mídia é o que leva a conversa para uma pessoa
   * quando o desenho não trata — a resposta certa para "chegou algo que não sei
   * ler". Virar texto vazio seria o bot respondendo ao nada.
   */
  it('menção em story cai no caminho de mídia, e não em texto vazio', () => {
    const m = paraMensagemInterna('igsid-contato', {
      mid: 'mid-6',
      attachments: [{ type: 'story_mention', payload: {} }],
    })

    expect(m?.type).toBe('sticker')
  })

  it('tipo de anexo que a Meta inventar amanhã não vira null', () => {
    const m = paraMensagemInterna('igsid-contato', {
      mid: 'mid-7',
      attachments: [{ type: 'coisa_nova_da_meta', payload: {} }],
    })

    // Cair em `sticker` manda para uma pessoa. Devolver `null` faria a mensagem
    // sumir sem ninguém perceber, que é o pior dos dois.
    expect(m?.type).toBe('sticker')
  })

  it('evento sem mensagem nenhuma é ignorado', () => {
    expect(paraMensagemInterna('igsid-contato', { mid: 'mid-8' })).toBeNull()
  })
})

/**
 * A armadilha número três vive no schema: `recipient` é a conta do cliente e
 * `sender` é quem escreveu. Trocados, a busca por canal nunca acha nada — em
 * silêncio, para sempre.
 */
describe('o formato do webhook', () => {
  const exemplo = {
    object: 'instagram',
    entry: [
      {
        id: '178414',
        time: 1_760_000_000,
        messaging: [
          {
            sender: { id: 'igsid-de-quem-escreveu' },
            recipient: { id: '178414' },
            timestamp: 1_760_000_000,
            message: { mid: 'mid-1', text: 'oi' },
          },
        ],
      },
    ],
  }

  it('lê sender e recipient sem trocar um pelo outro', () => {
    const lido = webhookDoInstagramSchema.parse(exemplo)
    const evento = lido.entry[0]!.messaging[0]!

    expect(evento.recipient.id).toBe('178414')
    expect(evento.sender.id).toBe('igsid-de-quem-escreveu')
  })

  it('campo novo da Meta não derruba o parse', () => {
    const comNovidade = {
      ...exemplo,
      entry: [{ ...exemplo.entry[0], campo_que_a_meta_inventou: true }],
    }

    expect(() => webhookDoInstagramSchema.parse(comNovidade)).not.toThrow()
  })

  it('evento que não é mensagem — leitura, reação — não estoura', () => {
    const soLeitura = {
      object: 'instagram',
      entry: [{ id: '178414', messaging: [{ sender: { id: 'x' }, recipient: { id: '178414' } }] }],
    }

    const lido = webhookDoInstagramSchema.parse(soLeitura)
    expect(lido.entry[0]!.messaging[0]!.message).toBeUndefined()
  })
})

/**
 * O caso real que segurou o canal de Instagram: o array `messaging` mistura a
 * mensagem com avisos de leitura, e o aviso não tem `sender` nem `recipient`.
 * Validando o lote inteiro de uma vez, o aviso derrubava a mensagem junto.
 */
describe('lote com aviso de leitura no meio', () => {
  const LEITURA = {
    timestamp: 1788530071837,
    read: { mid: 'aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlE' },
  }

  it('aceita um lote que só tem aviso de leitura, sem reprovar o payload', () => {
    const analise = webhookDoInstagramSchema.safeParse({
      object: 'instagram',
      entry: [{ time: 1788530072319, id: '17841400183953038', messaging: [LEITURA] }],
    })

    expect(analise.success).toBe(true)
    expect(analise.success && analise.data.entry[0]?.messaging).toEqual([null])
  })

  it('mantém a mensagem quando ela vem no mesmo lote que o aviso', () => {
    const analise = webhookDoInstagramSchema.safeParse({
      object: 'instagram',
      entry: [
        {
          id: '17841400183953038',
          messaging: [
            LEITURA,
            {
              sender: { id: '999' },
              recipient: { id: '17841400183953038' },
              message: { mid: 'm1', text: 'oi' },
            },
          ],
        },
      ],
    })

    expect(analise.success).toBe(true)
    const eventos = analise.success ? analise.data.entry[0]?.messaging : []
    expect(eventos?.[0]).toBeNull()
    expect(eventos?.[1]?.message?.text).toBe('oi')
  })
})
