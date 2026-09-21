import { afterEach, describe, expect, it, vi } from 'vitest'
import { canalTelegram } from './telegram'

function fingirFetch(implementacao?: () => Promise<Response>) {
  const espiao = vi.fn(
    implementacao ?? (async () => new Response('{"ok":true}', { status: 200 })),
  )
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

const TOKEN = '123456:token-de-mentira'

const canal = () => canalTelegram({ token: TOKEN, raiz: 'https://api.telegram.org' })

const opcao = (id: string, rotulo: string) => ({ id, rotulo }) as never

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('o adaptador do Telegram', () => {
  it('põe o token no caminho, e não num header', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('99001', 'oi')

    const [url, init] = chamadas(espiao)[0]!
    // A Bot API não conhece `Authorization`: o token é parte do endereço.
    // Mandá-lo no header faria toda chamada responder 401 sem dizer por quê.
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(corpos(espiao)[0]).toEqual({ chat_id: '99001', text: 'oi' })
  })

  /**
   * O campo obrigatório da Cloud API não existe aqui, e este adaptador nasceu
   * ao lado do dela. Copiar e esquecer de tirar é o erro mais provável.
   */
  it('não manda o `messaging_product` da Cloud API', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('99001', 'oi')

    expect(corpos(espiao)[0]).not.toHaveProperty('messaging_product')
  })

  /**
   * O teste que justifica `descrever()`: a URL carrega a credencial, então
   * nenhuma mensagem de erro pode repetir a URL. Se este teste quebrar, o
   * token do cliente está indo para o log de produção.
   */
  it('não deixa o token vazar na mensagem de erro', async () => {
    fingirFetch(async () => new Response('{"description":"chat not found"}', { status: 400 }))

    await expect(canal().enviarTexto('99001', 'oi')).rejects.toThrow(/chat not found/)
    await expect(canal().enviarTexto('99001', 'oi')).rejects.not.toThrow(
      expect.objectContaining({ message: expect.stringContaining(TOKEN) }) as never,
    )
  })

  it('não vaza o token quando o Telegram não responde no prazo', async () => {
    fingirFetch(async () => {
      const erro = new Error('demorou')
      erro.name = 'TimeoutError'
      throw erro
    })

    const falha = await canal()
      .enviarTexto('99001', 'oi')
      .catch((erro: Error) => erro)

    expect(String((falha as Error).message)).not.toContain(TOKEN)
  })

  it('as opções viram teclado inline com o id da opção no callback_data', async () => {
    const espiao = fingirFetch()

    await canal().enviarOpcoes(
      '99001',
      'Escolhe',
      [opcao('sim', 'Quero'), opcao('nao', 'Agora não')],
      'botoes',
    )

    expect(corpos(espiao)[0]).toEqual({
      chat_id: '99001',
      text: 'Escolhe',
      // Uma linha só: dois botões cabem nos 4 por linha do `canais.ts`.
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Quero', callback_data: 'sim' },
            { text: 'Agora não', callback_data: 'nao' },
          ],
        ],
      },
    })
  })

  it('quebra o teclado em linhas de 4', async () => {
    const espiao = fingirFetch()

    const cinco = ['a', 'b', 'c', 'd', 'e'].map((id) => opcao(id, id.toUpperCase()))
    await canal().enviarOpcoes('99001', 'Escolhe', cinco, 'botoes')

    const teclado = (corpos(espiao)[0]!.reply_markup as { inline_keyboard: unknown[][] })
      .inline_keyboard
    expect(teclado.map((linha) => linha.length)).toEqual([4, 1])
  })

  /**
   * O `formato` é do WhatsApp, que tem botão e lista. Aqui há uma forma só, e
   * "lista" não pode virar outra coisa às escondidas.
   */
  it('ignora o formato: lista também vira teclado inline', async () => {
    const espiao = fingirFetch()

    await canal().enviarOpcoes('99001', 'Escolhe', [opcao('sim', 'Quero')], 'lista')

    expect(corpos(espiao)[0]).toHaveProperty('reply_markup.inline_keyboard')
  })

  it('corta a lista no teto de opções em vez de ter a mensagem recusada', async () => {
    const espiao = fingirFetch()

    const doze = Array.from({ length: 12 }, (_, i) => opcao(`o${i}`, `Opção ${i}`))
    await canal().enviarOpcoes('99001', 'Escolhe', doze, 'botoes')

    const teclado = (corpos(espiao)[0]!.reply_markup as { inline_keyboard: unknown[][] })
      .inline_keyboard
    expect(teclado.flat()).toHaveLength(10)
  })

  it('corta o rótulo longo no limite do canal', async () => {
    const espiao = fingirFetch()

    await canal().enviarOpcoes('99001', 'Escolhe', [opcao('sim', 'x'.repeat(50))], 'botoes')

    const teclado = (
      corpos(espiao)[0]!.reply_markup as { inline_keyboard: { text: string }[][] }
    ).inline_keyboard
    expect(teclado[0]![0]!.text).toHaveLength(32)
  })

  /**
   * O teto de `callback_data` é contado em bytes pelo Telegram, e estourá-lo
   * faz a **mensagem inteira** ser recusada, não só o botão.
   */
  it('corta o callback_data por byte, sem partir caractere ao meio', async () => {
    const espiao = fingirFetch()

    // 40 "é" = 80 bytes em UTF-8, acima dos 64 permitidos.
    await canal().enviarOpcoes('99001', 'Escolhe', [opcao('é'.repeat(40), 'Ok')], 'botoes')

    const teclado = (
      corpos(espiao)[0]!.reply_markup as { inline_keyboard: { callback_data: string }[][] }
    ).inline_keyboard
    const dados = teclado[0]![0]!.callback_data
    expect(new TextEncoder().encode(dados).length).toBeLessThanOrEqual(64)
    // Nenhum caractere de substituição: o corte respeitou a fronteira.
    expect(dados).not.toContain('�')
    expect(dados).toBe('é'.repeat(32))
  })

  it('manda a legenda junto da mídia, e não como mensagem separada', async () => {
    const espiao = fingirFetch()

    await canal().enviarMidia('99001', {
      midia: 'imagem',
      url: 'https://exemplo/foto.jpg',
      legenda: 'olha',
    })

    // Uma chamada só, o Instagram precisa de duas, o Telegram não.
    expect(chamadas(espiao)).toHaveLength(1)
    expect(chamadas(espiao)[0]![0]).toContain('/sendPhoto')
    expect(corpos(espiao)[0]).toEqual({
      chat_id: '99001',
      photo: 'https://exemplo/foto.jpg',
      caption: 'olha',
    })
  })

  it('cada mídia tem o método e o campo dela', async () => {
    const espiao = fingirFetch()

    await canal().enviarMidia('99001', { midia: 'documento', url: 'https://exemplo/a.pdf' })

    expect(chamadas(espiao)[0]![0]).toContain('/sendDocument')
    expect(corpos(espiao)[0]).toEqual({ chat_id: '99001', document: 'https://exemplo/a.pdf' })
  })

  it('cita a mensagem anterior quando pedem', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('99001', 'oi', '4242')

    expect(corpos(espiao)[0]).toEqual({
      chat_id: '99001',
      text: 'oi',
      reply_parameters: { message_id: 4242, allow_sending_without_reply: true },
    })
  })

  /**
   * `types.ts`: o canal que não sabe citar entrega mesmo assim. Um id que não
   * é número do Telegram (um `wamid` da Meta, por exemplo) não pode derrubar
   * a resposta.
   */
  it('entrega sem citar quando a citação não é um id do Telegram', async () => {
    const espiao = fingirFetch()

    await canal().enviarTexto('99001', 'oi', 'wamid.HBgM')

    expect(corpos(espiao)[0]).toEqual({ chat_id: '99001', text: 'oi' })
  })

  it('mostra digitando antes de responder', async () => {
    const espiao = fingirFetch()

    await canal().aguardarResposta({ mensagemId: '1', contato: '99001' }, 0)

    expect(chamadas(espiao)[0]![0]).toContain('/sendChatAction')
    expect(corpos(espiao)[0]).toEqual({ chat_id: '99001', action: 'typing' })
  })

  it('responde mesmo se o digitando falhar', async () => {
    fingirFetch(async () => new Response('{"description":"flood"}', { status: 429 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Não estoura: o indicador é conveniência, não parte da entrega.
    await expect(
      canal().aguardarResposta({ mensagemId: '1', contato: '99001' }, 0),
    ).resolves.toBeUndefined()
  })
})
