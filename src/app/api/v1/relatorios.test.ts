import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lerConjunto } from '@/server/api/relatorios'
import { consumirLimite } from '@/server/limite'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { conferirChaveDeApi } from '@/server/repos/chaves-de-api'
import { GET } from './relatorios/[conjunto]/route'

/**
 * O conector de BI: porta, escopo, chave pela URL, consulta e os dois
 * formatos. O banco é mockado, como nas outras rotas da API.
 */

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('@/server/limite', () => ({ consumirLimite: vi.fn() }))
vi.mock('@/server/recursos-do-plano', () => ({ recusaDoPlano: vi.fn() }))
vi.mock('@/server/repos/chaves-de-api', () => ({ conferirChaveDeApi: vi.fn(), registrarUsoDaChave: vi.fn() }))
vi.mock('@/server/api/relatorios', () => ({ lerConjunto: vi.fn() }))

const CLIENTE = '11111111-1111-1111-1111-111111111111'
const CHAVE = `af_live_ABCDEFGHIJKL_${'s'.repeat(43)}`

const comEscopos = (...escopos: string[]) =>
  vi.mocked(conferirChaveDeApi).mockResolvedValue({ chaveId: 'k1', clienteId: CLIENTE, publico: 'ABCDEFGHIJKL', escopos: escopos as never })

const pedir = (caminho: string, comCabecalho = true) =>
  GET(
    new Request(`http://localhost/api/v1/relatorios/${caminho}`, {
      headers: comCabecalho ? { authorization: `Bearer ${CHAVE}` } : {},
    }),
    { params: Promise.resolve({ conjunto: caminho.split('?')[0]! }) },
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumirLimite).mockResolvedValue(true)
  vi.mocked(recusaDoPlano).mockResolvedValue(null)
  comEscopos('relatorios:ler')
  vi.mocked(lerConjunto).mockResolvedValue({ linhas: [{ id: 'v1', valor: 109.8, situacao: 'ganha' }], temMais: true })
})

describe('GET /api/v1/relatorios', () => {
  it('exige o escopo relatorios:ler', async () => {
    comEscopos('contatos:ler')
    const r = await pedir('vendas')
    expect(r.status).toBe(403)
    expect(lerConjunto).not.toHaveBeenCalled()
  })

  it('aceita a chave em ?chave= para Looker e Sheets', async () => {
    const r = await pedir(`vendas?chave=${CHAVE}`, false)
    expect(r.status).toBe(200)
    expect(conferirChaveDeApi).toHaveBeenCalledWith('ABCDEFGHIJKL', 's'.repeat(43))
  })

  it('sem chave nenhuma é 401', async () => {
    expect((await pedir('vendas', false)).status).toBe(401)
  })

  it('JSON com a próxima página e a conta da chave', async () => {
    const r = await pedir('vendas?desde=2026-10-01&ate=2026-10-31')
    expect(await r.json()).toEqual({ conjunto: 'vendas', pagina: 1, proxima_pagina: 2, linhas: 1, dados: [{ id: 'v1', valor: 109.8, situacao: 'ganha' }] })
    expect(vi.mocked(lerConjunto).mock.calls[0]![1]).toBe(CLIENTE)
  })

  it('CSV com as colunas do conjunto e a próxima página no cabeçalho', async () => {
    const r = await pedir('vendas?formato=csv')
    expect(r.headers.get('content-type')).toContain('text/csv')
    expect(r.headers.get('x-proxima-pagina')).toBe('2')
    const bytes = new Uint8Array(await r.arrayBuffer())
    // O BOM está nos bytes; o `text()` o engole na leitura.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const texto = new TextDecoder().decode(bytes)
    expect(texto.split('\r\n')[0]).toBe('id,contato_id,data_da_venda,valor,moeda,situacao,responsavel,criado_em')
    expect(texto.split('\r\n')[1]).toBe('v1,,,109.8,,ganha,,')
  })

  it('conjunto desconhecido e consulta inválida', async () => {
    expect((await pedir('senhas')).status).toBe(404)
    expect((await pedir('vendas?formato=xlsx')).status).toBe(400)
  })
})
