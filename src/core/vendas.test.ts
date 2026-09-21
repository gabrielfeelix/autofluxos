import { describe, expect, it } from 'vitest'
import {
  conferirTotal,
  conferirVenda,
  resumirVendas,
  totalDosItens,
  type ItemDaVenda,
} from './vendas'

/**
 * O que estes testes protegem: **desconhecido não é zero**.
 *
 * É a RB-06, e ela é fácil de quebrar sem perceber, porque `null ?? 0` parece
 * inofensivo e a soma continua rodando. O preço aparece na tela do dono como
 * uma receita menor que a verdade, com cara de número exato.
 */

const AGORA = Date.parse('2026-09-19T12:00:00.000Z')
const item = (d: string, q: number | null, v: number | null): ItemDaVenda => ({
  descricao: d,
  quantidade: q,
  valorUnitario: v,
})

describe('somar itens', () => {
  it('soma quando tudo é conhecido', () => {
    expect(totalDosItens([item('Plano XYZ', 2, 150)])).toBe(300)
    expect(totalDosItens([item('A', 1, 10.5), item('B', 3, 2)])).toBe(16.5)
  })

  /** O caso que faria a receita encolher em silêncio. */
  it('devolve desconhecido se faltar qualquer parte', () => {
    expect(totalDosItens([item('Sem valor', 2, null)])).toBeNull()
    expect(totalDosItens([item('Sem quantidade', null, 150)])).toBeNull()
    expect(totalDosItens([item('Ok', 1, 10), item('Faltando', 1, null)])).toBeNull()
  })

  /** Venda sem item detalhado não afirma que custou nada. */
  it('lista vazia é desconhecido, e não zero', () => {
    expect(totalDosItens([])).toBeNull()
  })

  it('não deixa o ponto flutuante vazar para o total', () => {
    expect(totalDosItens([item('Terço', 3, 1.1)])).toBe(3.3)
  })
})

describe('conferir o total informado', () => {
  it('aceita quando bate com os itens', () => {
    expect(conferirTotal(300, [item('Plano', 2, 150)]).ok).toBe(true)
  })

  it('recusa contradição e diz quanto dá a soma', () => {
    const conferido = conferirTotal(500, [item('Plano', 2, 150)])
    expect(conferido.ok).toBe(false)
    expect(conferido.ok === false && conferido.totalDosItens).toBe(300)
  })

  /**
   * Item incompleto não autoriza recusar o total digitado: a pessoa pode saber
   * o total sem saber a composição.
   */
  it('não confere o que não dá para conferir', () => {
    expect(conferirTotal(500, [item('Plano', null, null)]).ok).toBe(true)
    expect(conferirTotal(500, []).ok).toBe(true)
  })

  /** Total desconhecido é sempre aceito: é uma resposta, não uma omissão. */
  it('total não informado passa', () => {
    expect(conferirTotal(null, [item('Plano', 2, 150)]).ok).toBe(true)
  })

  it('tolera um centavo de arredondamento, mas não mais', () => {
    expect(conferirTotal(300.01, [item('Plano', 2, 150)]).ok).toBe(true)
    expect(conferirTotal(300.5, [item('Plano', 2, 150)]).ok).toBe(false)
  })
})

describe('a régua de uma venda nova', () => {
  it('exige data válida e não aceita futuro', () => {
    expect(conferirVenda({ dataDaVenda: 'ontem' }, AGORA).ok).toBe(false)
    expect(conferirVenda({ dataDaVenda: '2027-01-01T00:00:00Z' }, AGORA).ok).toBe(false)
    expect(conferirVenda({ dataDaVenda: '2026-09-19T10:00:00Z' }, AGORA).ok).toBe(true)
  })

  /**
   * O A14: "comprou, não sei quanto" é registro legítimo. Exigir valor faria
   * a pessoa inventar um número para conseguir salvar.
   */
  it('não exige valor, comprar sem saber quanto é caso real', () => {
    expect(conferirVenda({ dataDaVenda: '2026-09-18T10:00:00Z' }, AGORA).ok).toBe(true)
    expect(
      conferirVenda({ dataDaVenda: '2026-09-18T10:00:00Z', valorTotal: null }, AGORA).ok,
    ).toBe(true)
  })

  it('recusa valor negativo e item sem descrição', () => {
    expect(conferirVenda({ dataDaVenda: '2026-09-18T10:00:00Z', valorTotal: -5 }, AGORA).ok).toBe(
      false,
    )
    expect(
      conferirVenda(
        { dataDaVenda: '2026-09-18T10:00:00Z', itens: [item('  ', 1, 10)] },
        AGORA,
      ).ok,
    ).toBe(false)
  })

  it('recusa quantidade zero, que costuma ser dedo escorregado', () => {
    expect(
      conferirVenda(
        { dataDaVenda: '2026-09-18T10:00:00Z', itens: [item('Plano', 0, 10)] },
        AGORA,
      ).ok,
    ).toBe(false)
  })
})

describe('resumir as vendas de um contato', () => {
  const venda = (
    valorTotal: number | null,
    situacao: 'valida' | 'cancelada',
    dataDaVenda: string,
  ) => ({ valorTotal, situacao, dataDaVenda })

  it('conta compras e soma só o que se sabe', () => {
    const resumo = resumirVendas([
      venda(200, 'valida', '2026-09-01'),
      venda(null, 'valida', '2026-09-10'),
      venda(350.5, 'valida', '2026-09-05'),
    ])

    expect(resumo.compras).toBe(3)
    expect(resumo.totalConhecido).toBe(550.5)
    // A informação que a tela precisa para não mentir:
    expect(resumo.semValor).toBe(1)
    expect(resumo.ultimaEm).toBe('2026-09-10')
  })

  /** O A15: cancelar tira dos indicadores, sem apagar o registro. */
  it('venda cancelada não conta em lugar nenhum', () => {
    const resumo = resumirVendas([
      venda(200, 'valida', '2026-09-01'),
      venda(999, 'cancelada', '2026-09-30'),
    ])

    expect(resumo.compras).toBe(1)
    expect(resumo.totalConhecido).toBe(200)
    // E a recência não pode ficar na venda cancelada:
    expect(resumo.ultimaEm).toBe('2026-09-01')
  })

  /** Sem venda nenhuma: zero compras e **nenhuma** data. */
  it('sem compras, a última data é desconhecida e não hoje', () => {
    const resumo = resumirVendas([])
    expect(resumo.compras).toBe(0)
    expect(resumo.totalConhecido).toBe(0)
    expect(resumo.ultimaEm).toBeNull()
  })

  /**
   * O caso que engana: três compras, nenhuma com valor. O total conhecido é
   * zero, mas isso **não** quer dizer que renderam zero.
   */
  it('total zero com semValor alto não é o mesmo que não ter rendido', () => {
    const resumo = resumirVendas([
      venda(null, 'valida', '2026-09-01'),
      venda(null, 'valida', '2026-09-02'),
    ])
    expect(resumo.compras).toBe(2)
    expect(resumo.totalConhecido).toBe(0)
    expect(resumo.semValor).toBe(2)
  })
})
