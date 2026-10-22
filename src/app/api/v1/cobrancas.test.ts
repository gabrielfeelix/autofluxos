import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CobrancaDaApi } from '@/core/api/cobrancas'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi } from '@/server/repos/chaves-de-api'
import { criarCobrancaPelaApi, listarCobrancasDaApi } from '@/server/api/cobrancas'
import { concluirIdempotencia, liberarIdempotencia, reservarIdempotencia } from '@/server/repos/idempotencia-da-api'
import { GET, POST } from './cobrancas/route'

/**
 * `GET` e `POST /api/v1/cobrancas` (frente 4): porta, escopo, schema,
 * idempotência e contrato HTTP. O que acontece no gateway é mockado.
 */

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))
vi.mock('@/server/repos/cobrancas', () => ({ STATUS_DE_COBRANCA: ['pendente', 'paga', 'vencida', 'cancelada', 'estornada'] }))
vi.mock('@/server/api/cobrancas', () => ({
  LIMITE_PADRAO_DE_COBRANCAS: 50,
  LIMITE_MAXIMO_DE_COBRANCAS: 100,
  criarCobrancaPelaApi: vi.fn(),
  listarCobrancasDaApi: vi.fn(),
}))
vi.mock('@/server/repos/idempotencia-da-api', () => ({
  reservarIdempotencia: vi.fn(),
  concluirIdempotencia: vi.fn(),
  liberarIdempotencia: vi.fn(),
}))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`

const COBRANCA: CobrancaDaApi = {
  id: 'cb1',
  contato_id: 'c1',
  descricao: 'Mensalidade de novembro',
  valor: 49.9,
  status: 'pendente',
  gateway: 'asaas',
  pix_copia_cola: '000201...',
  link: 'https://www.asaas.com/i/abc',
  vence_em: '2026-11-01T21:00:00.000Z',
  paga_em: null,
  cancelada_em: null,
  origem: 'api',
  criado_em: '2026-10-22T12:00:00.000Z',
}

function pedir(caminho: string, metodo = 'GET', corpo?: unknown, chave: string | null = 'pedido-1') {
  return new Request(`http://localhost/api/v1/${caminho}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${CHAVE}`,
      ...(chave ? { 'idempotency-key': chave } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

function comEscopos(...escopos: string[]) {
  vi.mocked(conferirChaveDeApi).mockResolvedValue({ chaveId: 'k1', clienteId: CLIENTE, publico: 'ABCDEFGHIJKL', escopos: escopos as never })
}

async function codigo(r: Response) {
  return ((await r.json()) as { erro: { codigo: string } }).erro.codigo
}

const CORPO = { telefone: '5511999998888', valor: 49.9, descricao: 'Mensalidade de novembro' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumirLimite).mockResolvedValue(true)
  vi.mocked(recusaDoPlano).mockResolvedValue(null)
  vi.mocked(reservarIdempotencia).mockResolvedValue({ tipo: 'nova' })
  comEscopos('cobrancas:ler', 'cobrancas:criar')
})

describe('GET /api/v1/cobrancas', () => {
  it('lista da conta da chave, com telefone, status e limite', async () => {
    vi.mocked(listarCobrancasDaApi).mockResolvedValue([COBRANCA])
    const r = await GET(pedir('cobrancas?telefone=5511999998888&status=paga&limite=10'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ cobrancas: [COBRANCA] })
    expect(listarCobrancasDaApi).toHaveBeenCalledWith(CLIENTE, { limite: 10, telefone: '5511999998888', status: 'paga' })
  })

  it('limite padrão 50; status desconhecido e limite acima de 100 são 422', async () => {
    vi.mocked(listarCobrancasDaApi).mockResolvedValue([])
    await GET(pedir('cobrancas'))
    expect(vi.mocked(listarCobrancasDaApi).mock.calls[0]?.[1]).toEqual({ limite: 50 })
    expect((await GET(pedir('cobrancas?status=aberta'))).status).toBe(422)
    expect((await GET(pedir('cobrancas?limite=500'))).status).toBe(422)
  })

  it('telefone que não é contato é 404', async () => {
    vi.mocked(listarCobrancasDaApi).mockResolvedValue(null)
    const r = await GET(pedir('cobrancas?telefone=5511000000000'))
    expect(r.status).toBe(404)
    expect(await codigo(r)).toBe('contato_nao_encontrado')
  })

  it('pede cobrancas:ler', async () => {
    comEscopos('cobrancas:criar')
    expect(await codigo(await GET(pedir('cobrancas')))).toBe('escopo_insuficiente')
  })
})

describe('POST /api/v1/cobrancas', () => {
  it('cria em centavos, vence em 24h por padrão, guarda a resposta e devolve 201', async () => {
    vi.mocked(criarCobrancaPelaApi).mockResolvedValue({ ok: true, cobranca: COBRANCA })
    const antes = Date.now()
    const r = await POST(pedir('cobrancas', 'POST', { ...CORPO, valor: 19.99 }))
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ cobranca: COBRANCA })

    const pedido = vi.mocked(criarCobrancaPelaApi).mock.calls[0]?.[1]
    expect(pedido?.valorCentavos).toBe(1999)
    expect(pedido?.venceEm.getTime()).toBeGreaterThanOrEqual(antes + 24 * 3_600_000)
    expect(concluirIdempotencia).toHaveBeenCalledWith(CLIENTE, 'pedido-1', 201, { cobranca: COBRANCA })
  })

  it('sem Idempotency-Key é 400 e nada é criado', async () => {
    const r = await POST(pedir('cobrancas', 'POST', CORPO, null))
    expect(r.status).toBe(400)
    expect(await codigo(r)).toBe('idempotencia_obrigatoria')
    expect(criarCobrancaPelaApi).not.toHaveBeenCalled()
  })

  it('repetida devolve a resposta guardada sem criar de novo', async () => {
    vi.mocked(reservarIdempotencia).mockResolvedValue({ tipo: 'repetida', status: 201, resposta: { cobranca: COBRANCA } })
    const r = await POST(pedir('cobrancas', 'POST', CORPO))
    expect(r.status).toBe(201)
    expect(r.headers.get('Idempotent-Replayed')).toBe('true')
    expect(criarCobrancaPelaApi).not.toHaveBeenCalled()
  })

  it('valor com três casas, zero ou texto é 422', async () => {
    for (const valor of [10.005, 0, -5, '49.90']) {
      const r = await POST(pedir('cobrancas', 'POST', { ...CORPO, valor }))
      expect(r.status).toBe(422)
    }
    expect(reservarIdempotencia).not.toHaveBeenCalled()
  })

  it('vencimento em cima da hora ou longe demais é 422', async () => {
    const daqui = (ms: number) => new Date(Date.now() + ms).toISOString()
    expect((await POST(pedir('cobrancas', 'POST', { ...CORPO, vence_em: daqui(5 * 60_000) }))).status).toBe(422)
    expect((await POST(pedir('cobrancas', 'POST', { ...CORPO, vence_em: daqui(40 * 86_400_000) }))).status).toBe(422)
    vi.mocked(criarCobrancaPelaApi).mockResolvedValue({ ok: true, cobranca: COBRANCA })
    expect((await POST(pedir('cobrancas', 'POST', { ...CORPO, vence_em: daqui(3 * 86_400_000) }))).status).toBe(201)
  })

  it('recusa do gateway ou sem conta conectada libera a chave e devolve o código', async () => {
    vi.mocked(criarCobrancaPelaApi).mockResolvedValue({
      ok: false,
      status: 409,
      codigo: 'sem_conta_de_recebimento',
      mensagem: 'Conecte uma conta de recebimento em Ajustes > Pagamentos.',
    })
    const r = await POST(pedir('cobrancas', 'POST', CORPO))
    expect(r.status).toBe(409)
    expect(await codigo(r)).toBe('sem_conta_de_recebimento')
    expect(liberarIdempotencia).toHaveBeenCalledWith(CLIENTE, 'pedido-1')
    expect(concluirIdempotencia).not.toHaveBeenCalled()
  })

  it('pede cobrancas:criar', async () => {
    comEscopos('cobrancas:ler')
    expect(await codigo(await POST(pedir('cobrancas', 'POST', CORPO)))).toBe('escopo_insuficiente')
  })
})
