import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi } from '@/server/repos/chaves-de-api'
import { enviarModeloPelaApi, listarTemplatesDaApi } from '@/server/api/templates'
import {
  concluirIdempotencia,
  liberarIdempotencia,
  reservarIdempotencia,
} from '@/server/repos/idempotencia-da-api'
import { GET as getTemplates } from './templates/route'
import { POST as postTemplate } from './mensagens/template/route'

/**
 * As rotas da fase 2: listar modelos e enviar um. O que se prova é a porta
 * (escopo, plano), a `Idempotency-Key` e o contrato HTTP. O envio em si é
 * mockado.
 */

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))
vi.mock('@/server/api/templates', () => ({ enviarModeloPelaApi: vi.fn(), listarTemplatesDaApi: vi.fn() }))
vi.mock('@/server/repos/idempotencia-da-api', () => ({
  reservarIdempotencia: vi.fn(),
  concluirIdempotencia: vi.fn(),
  liberarIdempotencia: vi.fn(),
}))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`
const CORPO = { telefone: '5511987654321', template: 'lembrete', valores: { corpo: ['Ana', 14] } }

function pedir(caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  return new Request(`http://localhost/api/v1/${caminho}`, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CHAVE}`, ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

const enviar = (corpo: unknown = CORPO, chave: string | null = 'pedido-42') =>
  postTemplate(pedir('mensagens/template', corpo, chave ? { 'idempotency-key': chave } : {}))

function comEscopos(...escopos: string[]) {
  vi.mocked(conferirChaveDeApi).mockResolvedValue({ chaveId: 'k1', clienteId: CLIENTE, publico: 'ABCDEFGHIJKL', escopos: escopos as never })
}

async function codigo(r: Response) {
  return ((await r.json()) as { erro: { codigo: string } }).erro.codigo
}

const ENVIADA = {
  ok: true as const,
  corpo: {
    status: 'enviada' as const,
    mensagem_id: 'wamid.1',
    contato_id: 'c1',
    contato_criado: false,
    template: { nome: 'lembrete', idioma: 'pt_BR' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumirLimite).mockResolvedValue(true)
  vi.mocked(recusaDoPlano).mockResolvedValue(null)
  vi.mocked(reservarIdempotencia).mockResolvedValue({ tipo: 'nova' })
  comEscopos('mensagens:enviar')
})

describe('GET /api/v1/templates', () => {
  it('lista os aprovados da conta da chave', async () => {
    vi.mocked(listarTemplatesDaApi).mockResolvedValue([])
    const r = await getTemplates(pedir('templates'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ templates: [] })
    expect(listarTemplatesDaApi).toHaveBeenCalledWith(CLIENTE)
  })

  it('pede mensagens:enviar e o plano com API', async () => {
    comEscopos('contatos:ler')
    expect(await codigo(await getTemplates(pedir('templates')))).toBe('escopo_insuficiente')
    comEscopos('mensagens:enviar')
    vi.mocked(recusaDoPlano).mockResolvedValue('sem api')
    expect(await codigo(await getTemplates(pedir('templates')))).toBe('plano_sem_api')
  })
})

describe('POST /api/v1/mensagens/template', () => {
  it('202 quando envia, com valores numéricos virando texto, e guarda a resposta', async () => {
    vi.mocked(enviarModeloPelaApi).mockResolvedValue(ENVIADA)
    const r = await enviar()
    expect(r.status).toBe(202)
    expect(await r.json()).toEqual(ENVIADA.corpo)
    expect(vi.mocked(enviarModeloPelaApi).mock.calls[0]).toEqual([
      CLIENTE,
      { telefone: '5511987654321', template: 'lembrete', valores: { corpo: ['Ana', '14'] } },
    ])
    expect(concluirIdempotencia).toHaveBeenCalledWith(CLIENTE, 'pedido-42', 202, ENVIADA.corpo)
  })

  it('sem Idempotency-Key é 400 e nada é enviado', async () => {
    const r = await enviar(CORPO, null)
    expect(r.status).toBe(400)
    expect(await codigo(r)).toBe('idempotencia_obrigatoria')
    expect(enviarModeloPelaApi).not.toHaveBeenCalled()
  })

  it('repetida devolve a resposta guardada sem enviar de novo', async () => {
    vi.mocked(reservarIdempotencia).mockResolvedValue({ tipo: 'repetida', status: 202, resposta: ENVIADA.corpo })
    const r = await enviar()
    expect(r.status).toBe(202)
    expect(r.headers.get('Idempotent-Replayed')).toBe('true')
    expect(await r.json()).toEqual(ENVIADA.corpo)
    expect(enviarModeloPelaApi).not.toHaveBeenCalled()
  })

  it('em andamento é 409; mesma chave com outro corpo é 422', async () => {
    vi.mocked(reservarIdempotencia).mockResolvedValueOnce({ tipo: 'em_andamento' })
    const andamento = await enviar()
    expect(andamento.status).toBe(409)
    expect(await codigo(andamento)).toBe('requisicao_em_andamento')

    vi.mocked(reservarIdempotencia).mockResolvedValueOnce({ tipo: 'conflito' })
    expect(await codigo(await enviar())).toBe('idempotencia_conflito')
    expect(enviarModeloPelaApi).not.toHaveBeenCalled()
  })

  it('recusa libera a chave para a repetição poder tentar', async () => {
    vi.mocked(enviarModeloPelaApi).mockResolvedValue({ ok: false, status: 429, codigo: 'teto_diario', mensagem: 'teto' })
    const r = await enviar()
    expect(r.status).toBe(429)
    expect(await codigo(r)).toBe('teto_diario')
    expect(liberarIdempotencia).toHaveBeenCalledWith(CLIENTE, 'pedido-42')
    expect(concluirIdempotencia).not.toHaveBeenCalled()
  })

  it('erro inesperado é 500 e libera a chave', async () => {
    vi.mocked(enviarModeloPelaApi).mockRejectedValue(new Error('banco fora'))
    const r = await enviar()
    expect(r.status).toBe(500)
    expect(liberarIdempotencia).toHaveBeenCalled()
  })

  it('schema, escopo e plano vêm antes de reservar', async () => {
    expect((await enviar({ telefone: '1' })).status).toBe(422)
    comEscopos('contatos:escrever')
    expect((await enviar()).status).toBe(403)
    expect(reservarIdempotencia).not.toHaveBeenCalled()
  })
})
