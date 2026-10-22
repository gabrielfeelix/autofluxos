import { describe, expect, it } from 'vitest'
import { paraCobrancaDaApi, reaisParaCentavos } from './cobrancas'

describe('reaisParaCentavos', () => {
  it('converte sem erro de ponto flutuante', () => {
    expect(reaisParaCentavos(19.99)).toBe(1999)
    expect(reaisParaCentavos(0.29)).toBe(29)
    expect(reaisParaCentavos(1_000_000)).toBe(100_000_000)
  })

  it('recusa zero, negativo, infinito e mais de duas casas', () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 10.005]) expect(reaisParaCentavos(v)).toBeNull()
  })
})

describe('paraCobrancaDaApi', () => {
  it('valor em reais e nomes da API', () => {
    const api = paraCobrancaDaApi({
      id: 'cb1',
      contatoId: null,
      descricao: 'Aula avulsa',
      valorCentavos: 4990,
      status: 'paga',
      gateway: 'mercado_pago',
      pixCopiaCola: null,
      link: 'https://mpago.la/x',
      venceEm: '2026-11-01T21:00:00Z',
      pagaEm: '2026-10-30T10:00:00Z',
      canceladaEm: null,
      origem: 'inbox',
      criadoEm: '2026-10-22T12:00:00Z',
    })
    expect(api).toMatchObject({ id: 'cb1', contato_id: null, valor: 49.9, status: 'paga', paga_em: '2026-10-30T10:00:00Z' })
  })
})
