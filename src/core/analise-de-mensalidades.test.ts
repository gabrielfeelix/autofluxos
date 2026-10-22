import { describe, expect, it } from 'vitest'
import { analisarMensalidades, type AssinaturaParaAnalise, type CobrancaDeMensalidade } from './analise-de-mensalidades'

const ini = new Date('2026-10-01T03:00:00Z')
const fim = new Date('2026-11-01T03:00:00Z')
const agora = new Date('2026-10-22T15:00:00Z')

const assinatura = (a: Partial<AssinaturaParaAnalise>): AssinaturaParaAnalise => ({
  id: 'a1',
  status: 'ativa',
  criadoEm: '2026-09-10T12:00:00Z',
  canceladaEm: null,
  ...a,
})
const cobranca = (c: Partial<CobrancaDeMensalidade>): CobrancaDeMensalidade => ({
  assinaturaId: 'a1',
  competencia: '2026-10',
  status: 'paga',
  valorCentavos: 28000,
  venceEm: '2026-10-10T03:00:00Z',
  pagaEm: '2026-10-09T12:00:00Z',
  ...c,
})

describe('análise das mensalidades', () => {
  it('em dia é a ativa sem vencida recente e não paga', () => {
    const r = analisarMensalidades(
      [assinatura({}), assinatura({ id: 'a2' }), assinatura({ id: 'a3', status: 'pausada' })],
      [cobranca({}), cobranca({ assinaturaId: 'a2', status: 'vencida', pagaEm: null })],
      ini,
      fim,
      agora,
    )
    expect(r.ativas).toBe(2)
    expect(r.emAtraso).toBe(1)
    expect(r.taxaEmDia).toBe(0.5)
    expect(r.pausadas).toBe(1)
    expect(r.recebidoCentavos).toBe(28000)
  })

  it('vencida que depois foi paga no mesmo mês não conta como atraso', () => {
    const r = analisarMensalidades(
      [assinatura({})],
      [cobranca({ status: 'vencida', pagaEm: null }), cobranca({})],
      ini,
      fim,
      agora,
    )
    expect(r.emAtraso).toBe(0)
  })

  it('novas e canceladas pelo período', () => {
    const r = analisarMensalidades(
      [
        assinatura({ criadoEm: '2026-10-05T12:00:00Z' }),
        assinatura({ id: 'a2', status: 'cancelada', canceladaEm: '2026-10-15T12:00:00Z' }),
        assinatura({ id: 'a3', status: 'aguardando', criadoEm: '2026-10-20T12:00:00Z' }),
      ],
      [],
      ini,
      fim,
      agora,
    )
    expect(r.novas).toBe(2)
    expect(r.canceladas).toBe(1)
    expect(r.aguardandoAdesao).toBe(1)
  })
})
