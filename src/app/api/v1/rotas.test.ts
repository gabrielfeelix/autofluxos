import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi } from '@/server/repos/chaves-de-api'
import { gravarContatoDaApi, lerContatoPeloTelefone, type ContatoDaApi } from '@/server/api/contatos'
import { acharContatoPeloTelefone } from '@/server/repos/contato-por-telefone'
import { acharFluxo, listarFluxos } from '@/server/repos/fluxos'
import { abrirFluxoParaContato } from '@/server/receber-mensagem'
import { POST as postContatos } from './contatos/route'
import { GET as getContato } from './contatos/[telefone]/route'
import { GET as getFluxos } from './fluxos/route'
import { POST as postDisparar } from './fluxos/[fluxoId]/disparar/route'

/**
 * As quatro rotas da fase 1, cada uma com auth, escopo, plano e schema.
 *
 * O banco é mockado: o que se prova aqui é a porta e o contrato HTTP (status,
 * `codigo`, de onde vem o cliente). A chave de verdade é provada em
 * `server/api/autenticar.test.ts`.
 */

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))
vi.mock('@/server/api/contatos', () => ({
  LIMITE_PADRAO_DA_LISTA: 50,
  LIMITE_MAXIMO_DA_LISTA: 100,
  gravarContatoDaApi: vi.fn(),
  lerContatoPeloTelefone: vi.fn(),
  listarContatosDaApi: vi.fn(),
}))
vi.mock('@/server/repos/contato-por-telefone', () => ({ acharContatoPeloTelefone: vi.fn() }))
vi.mock('@/server/repos/fluxos', () => ({ acharFluxo: vi.fn(), listarFluxos: vi.fn() }))
vi.mock('@/server/receber-mensagem', () => ({ abrirFluxoParaContato: vi.fn() }))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const OUTRO = '22222222-2222-2222-2222-222222222222'
const FLUXO = '33333333-3333-3333-3333-333333333333'
const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`

const CONTATO: ContatoDaApi = {
  id: 'c1',
  nome: 'Maria',
  telefone: '5511987654321',
  campos: { origem: 'API' },
  etiquetas: [],
  estagio: 'novo',
  criado_em: '2026-10-02T12:00:00Z',
}

function pedir(caminho: string, corpo?: unknown, chave: string | null = CHAVE) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (chave) headers.authorization = `Bearer ${chave}`
  return new Request(`http://localhost/api/v1/${caminho}`, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers,
    body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })
}

function comEscopos(...escopos: string[]) {
  vi.mocked(conferirChaveDeApi).mockResolvedValue({
    chaveId: 'k1',
    clienteId: CLIENTE,
    publico: 'ABCDEFGHIJKL',
    escopos: escopos as never,
  })
}

async function codigo(r: Response) {
  return ((await r.json()) as { erro: { codigo: string } }).erro.codigo
}

const params = <T,>(valor: T) => ({ params: Promise.resolve(valor) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumirLimite).mockResolvedValue(true)
  vi.mocked(recusaDoPlano).mockResolvedValue(null)
  comEscopos('contatos:ler', 'contatos:escrever', 'fluxos:disparar')
})

describe('POST /api/v1/contatos', () => {
  it('201 quando cria, 200 quando atualiza, e o cliente vem da chave', async () => {
    vi.mocked(gravarContatoDaApi).mockResolvedValueOnce({ ok: true, criado: true, contato: CONTATO, avisos: [] })
    const criado = await postContatos(pedir('contatos', { telefone: '11987654321', nome: 'Maria', clienteId: OUTRO }))
    expect(criado.status).toBe(201)
    expect(vi.mocked(gravarContatoDaApi).mock.calls[0]?.[0]).toBe(CLIENTE)

    vi.mocked(gravarContatoDaApi).mockResolvedValueOnce({ ok: true, criado: false, contato: CONTATO, avisos: ['x'] })
    const atualizado = await postContatos(pedir('contatos', { telefone: '11987654321' }))
    expect(atualizado.status).toBe(200)
    expect(await atualizado.json()).toEqual({ contato: CONTATO, avisos: ['x'] })
  })

  it('campos numéricos viram texto', async () => {
    vi.mocked(gravarContatoDaApi).mockResolvedValue({ ok: true, criado: true, contato: CONTATO, avisos: [] })
    await postContatos(pedir('contatos', { telefone: '11987654321', campos: { idade: 30, vip: true } }))
    expect(vi.mocked(gravarContatoDaApi).mock.calls[0]?.[1].campos).toEqual({ idade: '30', vip: 'true' })
  })

  it('sem chave é 401; sem escopo é 403; plano sem API é 403', async () => {
    expect((await postContatos(pedir('contatos', { telefone: '1' }, null))).status).toBe(401)

    comEscopos('contatos:ler')
    const semEscopo = await postContatos(pedir('contatos', { telefone: '1' }))
    expect(semEscopo.status).toBe(403)
    expect(await codigo(semEscopo)).toBe('escopo_insuficiente')

    comEscopos('contatos:escrever')
    vi.mocked(recusaDoPlano).mockResolvedValue('sem api')
    expect(await codigo(await postContatos(pedir('contatos', { telefone: '1' })))).toBe('plano_sem_api')
    expect(gravarContatoDaApi).not.toHaveBeenCalled()
  })

  it('JSON quebrado é 400, corpo fora do schema é 422, telefone sem DDD é 422', async () => {
    expect((await postContatos(pedir('contatos', '{'))).status).toBe(400)
    const fora = await postContatos(pedir('contatos', { nome: 'sem telefone' }))
    expect(fora.status).toBe(422)
    expect(await codigo(fora)).toBe('corpo_invalido')

    vi.mocked(gravarContatoDaApi).mockResolvedValue({ ok: false, motivo: 'telefone_invalido' })
    const semDdd = await postContatos(pedir('contatos', { telefone: '987654321' }))
    expect(semDdd.status).toBe(422)
    expect(await codigo(semDdd)).toBe('telefone_invalido')
  })
})

describe('GET /api/v1/contatos/{telefone}', () => {
  it('devolve o contato da conta da chave, ou 404', async () => {
    vi.mocked(lerContatoPeloTelefone).mockResolvedValueOnce(CONTATO)
    const achou = await getContato(pedir('contatos/5511987654321'), params({ telefone: '5511987654321' }))
    expect(achou.status).toBe(200)
    expect(lerContatoPeloTelefone).toHaveBeenCalledWith(CLIENTE, '5511987654321')

    vi.mocked(lerContatoPeloTelefone).mockResolvedValueOnce(null)
    const nao = await getContato(pedir('contatos/1'), params({ telefone: '1' }))
    expect(nao.status).toBe(404)
    expect(await codigo(nao)).toBe('contato_nao_encontrado')
  })

  it('pede contatos:ler', async () => {
    comEscopos('contatos:escrever')
    expect((await getContato(pedir('contatos/1'), params({ telefone: '1' }))).status).toBe(403)
  })
})

describe('GET /api/v1/fluxos', () => {
  it('lista só os publicados e ligados', async () => {
    vi.mocked(listarFluxos).mockResolvedValue([
      { id: 'a', nome: 'No ar', ativo: true, versaoPublicadaId: 'v', canal: 'whatsapp' },
      { id: 'b', nome: 'Desligado', ativo: false, versaoPublicadaId: 'v', canal: 'whatsapp' },
      { id: 'c', nome: 'Rascunho', ativo: true, versaoPublicadaId: null, canal: 'whatsapp' },
    ] as never)
    const r = await getFluxos(pedir('fluxos'))
    expect(await r.json()).toEqual({ fluxos: [{ id: 'a', nome: 'No ar', canal: 'whatsapp' }] })
    expect(listarFluxos).toHaveBeenCalledWith(CLIENTE)
  })

  it('pede fluxos:disparar', async () => {
    comEscopos('contatos:ler')
    expect((await getFluxos(pedir('fluxos'))).status).toBe(403)
  })
})

describe('POST /api/v1/fluxos/{fluxoId}/disparar', () => {
  const fluxo = { id: FLUXO, clienteId: CLIENTE, ativo: true, versaoPublicadaId: 'v' }

  beforeEach(() => {
    vi.mocked(acharFluxo).mockResolvedValue(fluxo as never)
    vi.mocked(acharContatoPeloTelefone).mockResolvedValue('c1')
  })

  const disparar = (corpo: unknown = { telefone: '5511987654321' }, id = FLUXO) =>
    postDisparar(pedir(`fluxos/${id}/disparar`, corpo), params({ fluxoId: id }))

  it('202 quando abre', async () => {
    vi.mocked(abrirFluxoParaContato).mockResolvedValue('aberto')
    const r = await disparar()
    expect(r.status).toBe(202)
    expect(abrirFluxoParaContato).toHaveBeenCalledWith(CLIENTE, 'c1', FLUXO)
  })

  it('409 com o resultado como codigo', async () => {
    for (const [resultado, esperado] of [
      ['janela_fechada', 'janela_fechada'],
      ['atendimento_humano', 'atendimento_humano'],
      ['ocupado', 'ocupado'],
      ['automacao_pausada', 'automacao_pausada'],
      ['sem_contexto', 'sem_conversa'],
    ] as const) {
      vi.mocked(abrirFluxoParaContato).mockResolvedValueOnce(resultado)
      const r = await disparar()
      expect(r.status).toBe(409)
      expect(await codigo(r)).toBe(esperado)
    }
  })

  it('404 para fluxo de outra conta, desligado, id torto, e para contato desconhecido', async () => {
    vi.mocked(acharFluxo).mockResolvedValueOnce({ ...fluxo, clienteId: OUTRO } as never)
    expect(await codigo(await disparar())).toBe('fluxo_nao_encontrado')
    vi.mocked(acharFluxo).mockResolvedValueOnce({ ...fluxo, ativo: false } as never)
    expect(await codigo(await disparar())).toBe('fluxo_nao_encontrado')
    expect(await codigo(await disparar(undefined, 'nao-e-uuid'))).toBe('fluxo_nao_encontrado')

    vi.mocked(acharContatoPeloTelefone).mockResolvedValueOnce(null)
    const r = await disparar()
    expect(r.status).toBe(404)
    expect(await codigo(r)).toBe('contato_nao_encontrado')
    expect(abrirFluxoParaContato).not.toHaveBeenCalled()
  })

  it('schema e escopo', async () => {
    expect((await disparar({})).status).toBe(422)
    comEscopos('contatos:escrever')
    expect((await disparar()).status).toBe(403)
  })
})
