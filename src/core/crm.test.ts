import { describe, expect, it } from 'vitest'
import {
  DIAS_PARA_INATIVAR,
  MOTIVOS_INICIAIS,
  comoDinheiro,
  comoFrase,
  conferirFechamento,
  estagioDepoisDe,
  lerValor,
  podeEncadear,
  resumoDoCliente,
} from './crm'

/**
 * A régua do CRM.
 *
 * Os testes que importam aqui não são os de formato, são os três que protegem
 * decisões de produto que alguém pode achar que é bug e "consertar": cliente
 * não regride, perder exige motivo, e cadeia de funis não se morde.
 */

describe('estágio', () => {
  it('promove o novo que se qualificou', () => {
    expect(estagioDepoisDe('novo', 'qualificou')).toBe('qualificado')
  })

  it('não rebaixa quem já é cliente quando ele se qualifica de novo', () => {
    expect(estagioDepoisDe('cliente', 'qualificou')).toBeNull()
  })

  it('faz virar cliente no primeiro ganho', () => {
    expect(estagioDepoisDe('negociando', 'ganhou')).toBe('cliente')
  })

  it('não mexe no cliente que ganha de novo', () => {
    expect(estagioDepoisDe('cliente', 'ganhou')).toBeNull()
  })

  it('não chama de perdido quem já comprou uma vez', () => {
    // A regra inteira do modelo: perder uma negociação nova de quem já é cliente
    // não desfaz a compra antiga.
    expect(estagioDepoisDe('cliente', 'perdeu')).toBeNull()
  })

  it('não perde quem ainda tem outra negociação aberta', () => {
    expect(estagioDepoisDe('negociando', 'perdeu', { temOutroAberto: true })).toBeNull()
  })

  it('perde quem não tem mais nada aberto', () => {
    expect(estagioDepoisDe('negociando', 'perdeu')).toBe('perdido')
  })

  it('cliente que some fica inativo, nunca perdido', () => {
    expect(estagioDepoisDe('cliente', 'sumiu')).toBe('inativo')
  })

  it('devolve o cliente inativo que voltou a falar', () => {
    expect(estagioDepoisDe('inativo', 'voltou-a-falar', { jaComprou: true })).toBe('cliente')
    expect(estagioDepoisDe('inativo', 'voltou-a-falar', { jaComprou: false })).toBe('novo')
  })

  it('reabre o perdido que escreveu de novo', () => {
    expect(estagioDepoisDe('perdido', 'voltou-a-falar')).toBe('novo')
  })

  it('tem uma janela de inatividade que cobre a recompra trimestral', () => {
    expect(DIAS_PARA_INATIVAR).toBeGreaterThanOrEqual(90)
  })
})

describe('valor', () => {
  it('lê o que a mão digita', () => {
    expect(lerValor('1.500')).toEqual({ ok: true, valor: 1500 })
    expect(lerValor('1.234,56')).toEqual({ ok: true, valor: 1234.56 })
    expect(lerValor('1234.56')).toEqual({ ok: true, valor: 1234.56 })
    expect(lerValor('R$ 89,90')).toEqual({ ok: true, valor: 89.9 })
    // A ambiguidade do ponto: três dígitos é milhar, dois é centavo.
    expect(lerValor('1.50')).toEqual({ ok: true, valor: 1.5 })
    expect(lerValor('12.000')).toEqual({ ok: true, valor: 12000 })
  })

  it('aceita vazio: nem toda venda tem valor conhecido na hora', () => {
    expect(lerValor('   ')).toEqual({ ok: true, valor: null })
  })

  it('recusa texto', () => {
    expect(lerValor('caro').ok).toBe(false)
    expect(lerValor('12,345').ok).toBe(false)
  })

  it('formata em real', () => {
    expect(comoDinheiro(1500)).toMatch(/1\.500,00/)
    expect(comoDinheiro(null)).toBe('')
  })
})

describe('fechamento', () => {
  const motivos = [...MOTIVOS_INICIAIS]

  it('deixa ganhar sem valor', () => {
    expect(conferirFechamento('ganha', {}, motivos)).toEqual({ ok: true })
  })

  it('não deixa perder sem motivo', () => {
    // Motivo opcional produziria um relatório com 80% de "não informado", que é
    // o mesmo que não ter registrado nada.
    expect(conferirFechamento('perdida', {}, motivos).ok).toBe(false)
  })

  it('não aceita motivo fora da lista da conta', () => {
    expect(conferirFechamento('perdida', { motivo: 'achou caro' }, motivos).ok).toBe(false)
  })

  it('aceita motivo da lista, sem ligar para maiúscula', () => {
    expect(conferirFechamento('perdida', { motivo: 'preço' }, motivos)).toEqual({ ok: true })
  })
})

describe('o que o cliente rendeu', () => {
  it('soma os ganhos e acha a última compra', () => {
    const r = resumoDoCliente([
      { valor: 200, fechadoEm: '2026-01-10T00:00:00Z' },
      { valor: 350.5, fechadoEm: '2026-06-02T00:00:00Z' },
      { valor: null, fechadoEm: '2026-03-01T00:00:00Z' },
    ])
    expect(r.total).toBe(550.5)
    expect(r.compras).toBe(3)
    expect(r.ultimaEm).toBe('2026-06-02T00:00:00Z')
  })

  it('não inventa número para quem nunca comprou', () => {
    expect(resumoDoCliente([])).toEqual({ total: 0, compras: 0, ultimaEm: null })
  })
})

describe('funis encadeados', () => {
  it('deixa montar SDR → Vendas → Pós-venda', () => {
    const cadeia = new Map<string, string | null>([
      ['sdr', null],
      ['vendas', 'pos'],
      ['pos', null],
    ])
    expect(podeEncadear('sdr', 'vendas', cadeia)).toEqual({ ok: true })
  })

  it('recusa o quadro que aponta para ele mesmo', () => {
    expect(podeEncadear('a', 'a', new Map()).ok).toBe(false)
  })

  it('recusa o ciclo longo, que o banco não vê', () => {
    // A → B → C → A: ganhar em A jogaria a pessoa em B, C e de volta em A, sem
    // parar. É o caso que o `check` da 0058 não alcança.
    const cadeia = new Map<string, string | null>([
      ['b', 'c'],
      ['c', 'a'],
    ])
    expect(podeEncadear('a', 'b', cadeia).ok).toBe(false)
  })

  it('aceita desligar a cadeia', () => {
    expect(podeEncadear('a', null, new Map())).toEqual({ ok: true })
  })
})

describe('linha do tempo', () => {
  const base = { id: '1', autor: null, criadoEm: '2026-09-15T12:00:00Z' }

  it('cada linha se lê sozinha', () => {
    expect(comoFrase({ ...base, tipo: 'mudou-de-etapa', dados: { de: 'Novo', para: 'Proposta' } }))
      .toBe('saiu de Novo para Proposta')
    expect(comoFrase({ ...base, tipo: 'perdeu', dados: { motivo: 'Preço' } })).toBe('perdeu, Preço')
    expect(comoFrase({ ...base, tipo: 'ganhou', dados: { valor: 'R$ 1.500,00' } })).toBe(
      'ganhou, R$ 1.500,00',
    )
  })

  it('mostra o tipo cru em vez de sumir com o evento desconhecido', () => {
    expect(comoFrase({ ...base, tipo: 'coisa-nova', dados: {} })).toBe('coisa-nova')
  })
})
