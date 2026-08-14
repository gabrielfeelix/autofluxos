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

    const espera = canal.aguardarResposta('wamid-entrada-1', 1_000)
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

    const espera = canal.aguardarResposta('wamid-entrada-2', 1_000).then(() => {
      terminou = true
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(terminou).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await espera
    expect(terminou).toBe(true)
  })
})
