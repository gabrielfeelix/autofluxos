import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processarEntregas } from '@/server/webhooks-de-saida'
import { GET } from './route'

vi.mock('@/server/alertar', () => ({ alertar: vi.fn() }))
vi.mock('@/server/webhooks-de-saida', () => ({ processarEntregas: vi.fn() }))
vi.mock('@/server/repos/idempotencia-da-api', () => ({ limparIdempotenciaVencida: vi.fn().mockResolvedValue(2) }))

const pedir = (segredo?: string) =>
  new Request('http://localhost/api/manutencao/webhooks', { headers: segredo ? { authorization: `Bearer ${segredo}` } : {} })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'certo')
  vi.mocked(processarEntregas).mockResolvedValue({ enviadas: 1, falharam: 0 })
})

describe('GET /api/manutencao/webhooks', () => {
  it('falha fechada sem CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(pedir('certo'))).status).toBe(503)
    expect(processarEntregas).not.toHaveBeenCalled()
  })

  it('401 com o segredo errado', async () => {
    expect((await GET(pedir('errado'))).status).toBe(401)
  })

  it('processa a fila e limpa a idempotência', async () => {
    const r = await GET(pedir('certo'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ entregas: { enviadas: 1, falharam: 0 }, idempotenciaApagada: 2 })
    expect(processarEntregas).toHaveBeenCalledWith(50)
  })
})
