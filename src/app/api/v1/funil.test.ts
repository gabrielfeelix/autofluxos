import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi } from '@/server/repos/chaves-de-api'
import { listarContatosDaApi, listarEtiquetasDaApi } from '@/server/api/contatos'
import {
  abrirOportunidadePelaApi,
  listarFunisDaApi,
  listarOportunidadesDaApi,
  mudarOportunidadePelaApi,
  type OportunidadeDaApi,
} from '@/server/api/funil'
import { GET as getContatos } from './contatos/route'
import { GET as getEtiquetas } from './etiquetas/route'
import { GET as getFunil } from './funil/route'
import { GET as getOportunidades, POST as postOportunidade } from './funil/oportunidades/route'
import { PATCH as patchOportunidade } from './funil/oportunidades/[id]/route'

/**
 * As rotas da fase 4: leitura paginada, etiquetas e funil. Mesmo recorte das
 * outras: porta, escopo, plano, schema e contrato HTTP; o banco é mockado.
 */

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))
vi.mock('@/server/api/contatos', () => ({
  LIMITE_PADRAO_DA_LISTA: 50,
  LIMITE_MAXIMO_DA_LISTA: 100,
  gravarContatoDaApi: vi.fn(),
  listarContatosDaApi: vi.fn(),
  listarEtiquetasDaApi: vi.fn(),
}))
vi.mock('@/server/api/funil', () => ({
  abrirOportunidadePelaApi: vi.fn(),
  listarFunisDaApi: vi.fn(),
  listarOportunidadesDaApi: vi.fn(),
  mudarOportunidadePelaApi: vi.fn(),
}))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const ID = '44444444-4444-4444-4444-444444444444'
const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`

const OPORTUNIDADE: OportunidadeDaApi = {
  id: ID,
  contato_id: 'c1',
  funil: { id: 'f1', nome: 'Vendas' },
  etapa: { id: 'e1', nome: 'Novo contato' },
  situacao: 'aberta',
  titulo: null,
  valor: null,
  entrou_na_etapa_em: '2026-10-02T12:00:00Z',
}

function pedir(caminho: string, metodo = 'GET', corpo?: unknown) {
  return new Request(`http://localhost/api/v1/${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CHAVE}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

function comEscopos(...escopos: string[]) {
  vi.mocked(conferirChaveDeApi).mockResolvedValue({ chaveId: 'k1', clienteId: CLIENTE, publico: 'ABCDEFGHIJKL', escopos: escopos as never })
}

async function codigo(r: Response) {
  return ((await r.json()) as { erro: { codigo: string } }).erro.codigo
}

const params = <T,>(valor: T) => ({ params: Promise.resolve(valor) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumirLimite).mockResolvedValue(true)
  vi.mocked(recusaDoPlano).mockResolvedValue(null)
  comEscopos('contatos:ler', 'funil:ler', 'funil:escrever')
})

describe('GET /api/v1/contatos', () => {
  it('pagina com os filtros convertidos, da conta da chave', async () => {
    vi.mocked(listarContatosDaApi).mockResolvedValue({ ok: true, contatos: [], proximo_cursor: 'abc' })
    const r = await getContatos(pedir('contatos?limite=10&etiqueta=VIP&criado_desde=2026-09-01T00:00:00Z&cursor=xyz'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ contatos: [], proximo_cursor: 'abc' })
    expect(listarContatosDaApi).toHaveBeenCalledWith(CLIENTE, {
      limite: 10,
      cursor: 'xyz',
      etiqueta: 'VIP',
      criadoDesde: '2026-09-01T00:00:00Z',
    })
  })

  it('limite padrão 50; acima de 100 e data torta são 422', async () => {
    vi.mocked(listarContatosDaApi).mockResolvedValue({ ok: true, contatos: [], proximo_cursor: null })
    await getContatos(pedir('contatos'))
    expect(vi.mocked(listarContatosDaApi).mock.calls[0]?.[1]).toEqual({ limite: 50 })
    expect((await getContatos(pedir('contatos?limite=500'))).status).toBe(422)
    expect((await getContatos(pedir('contatos?criado_desde=ontem'))).status).toBe(422)
  })

  it('cursor inválido é 422; etiqueta inexistente é 404', async () => {
    vi.mocked(listarContatosDaApi).mockResolvedValueOnce({ ok: false, motivo: 'cursor_invalido' })
    expect(await codigo(await getContatos(pedir('contatos?cursor=x')))).toBe('cursor_invalido')
    vi.mocked(listarContatosDaApi).mockResolvedValueOnce({ ok: false, motivo: 'etiqueta_nao_encontrada' })
    const r = await getContatos(pedir('contatos?etiqueta=Nada'))
    expect(r.status).toBe(404)
    expect(await codigo(r)).toBe('etiqueta_nao_encontrada')
  })

  it('pede contatos:ler', async () => {
    comEscopos('contatos:escrever')
    expect((await getContatos(pedir('contatos'))).status).toBe(403)
  })
})

describe('GET /api/v1/etiquetas', () => {
  it('lista da conta da chave, com contatos:ler', async () => {
    vi.mocked(listarEtiquetasDaApi).mockResolvedValue([{ id: 'e', nome: 'VIP', cor: 'azul' }])
    expect(await (await getEtiquetas(pedir('etiquetas'))).json()).toEqual({ etiquetas: [{ id: 'e', nome: 'VIP', cor: 'azul' }] })
    expect(listarEtiquetasDaApi).toHaveBeenCalledWith(CLIENTE)
    comEscopos('funil:ler')
    expect((await getEtiquetas(pedir('etiquetas'))).status).toBe(403)
  })
})

describe('GET /api/v1/funil', () => {
  it('pede funil:ler e o plano', async () => {
    vi.mocked(listarFunisDaApi).mockResolvedValue([])
    expect((await getFunil(pedir('funil'))).status).toBe(200)
    comEscopos('contatos:ler')
    expect(await codigo(await getFunil(pedir('funil')))).toBe('escopo_insuficiente')
    comEscopos('funil:ler')
    vi.mocked(recusaDoPlano).mockResolvedValue('sem api')
    expect(await codigo(await getFunil(pedir('funil')))).toBe('plano_sem_api')
  })
})

describe('/api/v1/funil/oportunidades', () => {
  it('GET pede telefone; contato desconhecido é 404', async () => {
    expect((await getOportunidades(pedir('funil/oportunidades'))).status).toBe(422)
    vi.mocked(listarOportunidadesDaApi).mockResolvedValueOnce(null)
    expect(await codigo(await getOportunidades(pedir('funil/oportunidades?telefone=5511987654321')))).toBe('contato_nao_encontrado')
    vi.mocked(listarOportunidadesDaApi).mockResolvedValueOnce([OPORTUNIDADE])
    const r = await getOportunidades(pedir('funil/oportunidades?telefone=5511987654321&situacao=todas'))
    expect(await r.json()).toEqual({ oportunidades: [OPORTUNIDADE] })
    expect(listarOportunidadesDaApi).toHaveBeenLastCalledWith(CLIENTE, { telefone: '5511987654321', situacao: 'todas' })
  })

  it('POST: 201 quando abre, 200 quando já existia, recusa com o status do helper', async () => {
    vi.mocked(abrirOportunidadePelaApi).mockResolvedValueOnce({ ok: true, criada: true, oportunidade: OPORTUNIDADE })
    expect((await postOportunidade(pedir('funil/oportunidades', 'POST', { telefone: '5511987654321' }))).status).toBe(201)
    vi.mocked(abrirOportunidadePelaApi).mockResolvedValueOnce({ ok: true, criada: false, oportunidade: OPORTUNIDADE })
    expect((await postOportunidade(pedir('funil/oportunidades', 'POST', { telefone: '5511987654321' }))).status).toBe(200)
    vi.mocked(abrirOportunidadePelaApi).mockResolvedValueOnce({ ok: false, status: 404, codigo: 'funil_nao_encontrado', mensagem: 'x' })
    const r = await postOportunidade(pedir('funil/oportunidades', 'POST', { telefone: '5511987654321', funil_id: ID }))
    expect(r.status).toBe(404)
    expect(await codigo(r)).toBe('funil_nao_encontrado')
  })

  it('POST pede funil:escrever e id de funil válido', async () => {
    expect((await postOportunidade(pedir('funil/oportunidades', 'POST', { telefone: '1', funil_id: 'x' }))).status).toBe(422)
    comEscopos('funil:ler')
    expect((await postOportunidade(pedir('funil/oportunidades', 'POST', { telefone: '1' }))).status).toBe(403)
    expect(abrirOportunidadePelaApi).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/funil/oportunidades/{id}', () => {
  const mudar = (corpo: unknown, id = ID) => patchOportunidade(pedir(`funil/oportunidades/${id}`, 'PATCH', corpo), params({ id }))

  it('cada forma do corpo vira a mudança certa', async () => {
    vi.mocked(mudarOportunidadePelaApi).mockResolvedValue({ ok: true, oportunidade: OPORTUNIDADE })
    await mudar({ etapa_id: ID })
    await mudar({ situacao: 'ganha', valor: 450 })
    await mudar({ situacao: 'perdida', motivo: 'Preço' })
    expect(vi.mocked(mudarOportunidadePelaApi).mock.calls.map((c) => c[2])).toEqual([
      { etapaId: ID },
      { situacao: 'ganha', valor: 450 },
      { situacao: 'perdida', motivo: 'Preço' },
    ])
    expect(vi.mocked(mudarOportunidadePelaApi).mock.calls[0]?.[0]).toBe(CLIENTE)
  })

  it('corpo misturado ou perdida sem motivo é 422; id torto é 404', async () => {
    expect((await mudar({ etapa_id: ID, situacao: 'ganha' })).status).toBe(422)
    expect((await mudar({ situacao: 'perdida' })).status).toBe(422)
    expect(await codigo(await mudar({ etapa_id: ID }, 'nao-e-id'))).toBe('oportunidade_nao_encontrada')
    expect(mudarOportunidadePelaApi).not.toHaveBeenCalled()
  })

  it('recusa do helper sai com o status dele', async () => {
    vi.mocked(mudarOportunidadePelaApi).mockResolvedValue({ ok: false, status: 409, codigo: 'oportunidade_fechada', mensagem: 'x' })
    const r = await mudar({ situacao: 'ganha' })
    expect(r.status).toBe(409)
    expect(await codigo(r)).toBe('oportunidade_fechada')
  })
})
