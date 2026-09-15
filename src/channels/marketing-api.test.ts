import { afterEach, describe, expect, it, vi } from 'vitest'
import { lerNomesDoAnuncio } from './marketing-api'

afterEach(() => vi.unstubAllGlobals())

function respondeCom(corpo: unknown, status = 200) {
  const chamadas: string[] = []
  const espia = vi.fn(async (url: unknown) => {
    chamadas.push(String(url))
    return new Response(JSON.stringify(corpo), { status })
  })
  vi.stubGlobal('fetch', espia)
  return chamadas
}

describe('lerNomesDoAnuncio', () => {
  it('traz os três nomes de uma chamada só', async () => {
    const chamadas = respondeCom({
      name: 'Vídeo 30s',
      adset: { name: 'Retargeting' },
      campaign: { name: 'Institucional Set26' },
    })

    const r = await lerNomesDoAnuncio({ adId: '120210000000001', token: 't' })

    expect(r).toEqual({
      ok: true,
      nomes: { anuncio: 'Vídeo 30s', conjunto: 'Retargeting', campanha: 'Institucional Set26' },
    })

    // `fields` explícito: sem ele a Graph omite campaign/adset sem dizer por quê.
    const url = new URL(chamadas[0] ?? '')
    expect(url.searchParams.get('fields')).toBe('name,adset{name},campaign{name}')
    expect(url.pathname).toContain('120210000000001')
  })

  it('token vencido devolve o código 190, e não uma exceção', async () => {
    respondeCom({ error: { message: 'Invalid OAuth Access Token', code: 190 } }, 401)

    const r = await lerNomesDoAnuncio({ adId: 'a1', token: 'velho' })

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erro.codigo).toBe(190)
      expect(r.erro.mensagem).toContain('Invalid OAuth')
    }
  })

  it('rede fora do ar não derruba quem chamou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      }),
    )

    const r = await lerNomesDoAnuncio({ adId: 'a1', token: 't' })
    expect(r.ok).toBe(false)
  })

  it('campo que não é string vira vazio, e não quebra', async () => {
    respondeCom({ name: 42, adset: null, campaign: { name: 'Institucional' } })

    const r = await lerNomesDoAnuncio({ adId: 'a1', token: 't' })
    expect(r).toEqual({
      ok: true,
      nomes: { anuncio: '', conjunto: '', campanha: 'Institucional' },
    })
  })

  it('resposta que não é JSON ainda vira erro legível', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))

    const r = await lerNomesDoAnuncio({ adId: 'a1', token: 't' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro.mensagem).toContain('502')
  })
})
