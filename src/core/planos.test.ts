import { describe, expect, it } from 'vitest'

import {
  anualDoPlano,
  custoDaEquipe,
  tetoDeIaDaConta,
  PLANOS,
  comoTamanho,
  PLANO_DE_ENTRADA,
  PLANO_EM_DESTAQUE,
  acharPlano,
  fracaoUsada,
} from './planos'

describe('a tabela de planos', () => {
  it('tem as três faixas decididas, com preço e conversa crescentes', () => {
    expect(PLANOS.map((p) => p.id)).toEqual(['essencial', 'operacao', 'escala'])
    expect(PLANOS.map((p) => p.preco)).toEqual([297, 597, 1197])
    expect(PLANOS.map((p) => p.conversas)).toEqual([1000, 3000, 8000])
  })

  /*
   * Não é firula: uma faixa mais cara que comporta menos conversa é a tabela
   * dizendo ao cliente que subir de plano piora a vida dele, e é o tipo de erro
   * que passa por revisão porque cada linha, sozinha, parece certa.
   */
  it('nunca cobra mais por menos', () => {
    const precos = PLANOS.map((p) => p.preco)
    const conversas = PLANOS.map((p) => p.conversas)
    expect(precos).toEqual([...precos].sort((a, b) => a - b))
    expect(conversas).toEqual([...conversas].sort((a, b) => a - b))
    expect(new Set(precos).size).toBe(precos.length)
    expect(new Set(conversas).size).toBe(conversas.length)
  })

  /*
   * Atendente conta desde 05/out (reverte o "ilimitado" de 16/set). O card diz
   * a equipe inclusa, e o número bate com o campo que a cobrança lê.
   */
  it('diz a equipe inclusa, e ela bate com o campo', () => {
    expect(PLANOS.map((p) => p.atendentes)).toEqual([3, 10, 25])
    for (const plano of PLANOS) {
      expect(plano.itens).toContain(`${plano.atendentes} atendentes inclusos`)
      expect(plano.itens.join(' ')).not.toMatch(/atendentes? ilimitad/i)
    }
  })

  it('o atendente extra fica mais barato quanto maior o plano', () => {
    const extras = PLANOS.map((p) => p.precoAtendenteExtra)
    expect(extras).toEqual([69, 59, 49])
  })

  /*
   * A garantia que importa não é a posição, é a coerência: se o número escrito
   * no card divergir do campo `conversas`, a tela anuncia uma franquia que o
   * sistema não cobra, e ninguém descobre isso por revisão de código, descobre
   * por cliente reclamando.
   *
   * A linha existe em todos os planos; o que mudou foi onde ela entra.
   */
  it('diz a franquia, e ela bate com o campo', () => {
    for (const plano of PLANOS) {
      expect(plano.itens).toContain(
        `Até ${plano.conversas.toLocaleString('pt-BR')} conversas por mês`,
      )
    }
  })

  /*
   * Quem herda diz isso primeiro.
   *
   * "Tudo do Essencial" estava na terceira linha, abaixo de duas que se repetem
   * de um card para o outro, e ali ninguém a lia. É o argumento que transforma
   * três listas parecidas numa escada, e por isso a posição virou regra e não
   * gosto de quem editar o arquivo depois.
   */
  it('nos planos de cima, a herança abre a lista; no Essencial, a franquia', () => {
    const [essencial, ...herdeiros] = PLANOS
    expect(essencial!.itens[0]).toBe(
      `Até ${essencial!.conversas.toLocaleString('pt-BR')} conversas por mês`,
    )
    for (const plano of herdeiros) {
      expect(plano.itens[0]).toMatch(/^Tudo d/)
    }
  })

  it('aponta o plano de entrada e o destaque para faixas que existem', () => {
    expect(PLANOS.some((p) => p.id === PLANO_DE_ENTRADA)).toBe(true)
    expect(PLANOS.some((p) => p.id === PLANO_EM_DESTAQUE)).toBe(true)
  })
})

describe('acharPlano', () => {
  it('acha cada faixa pelo id', () => {
    expect(acharPlano('operacao').preco).toBe(597)
    expect(acharPlano('escala').nome).toBe('Escala')
  })

  /*
   * Uma conta com plano desconhecido no banco precisa continuar abrindo o
   * painel. Errar para o plano mais barato é o lado seguro de errar.
   */
  it('cai no plano de entrada quando o id não existe', () => {
    expect(acharPlano('inventado' as never).id).toBe(PLANO_DE_ENTRADA)
  })
})

describe('fracaoUsada', () => {
  it('mede o consumo contra a faixa do plano', () => {
    const essencial = acharPlano('essencial')
    expect(fracaoUsada(0, essencial)).toBe(0)
    expect(fracaoUsada(500, essencial)).toBe(0.5)
    expect(fracaoUsada(1000, essencial)).toBe(1)
  })

  it('passa de 1 quando a conta estourou, porque quem estourou precisa ver', () => {
    expect(fracaoUsada(1500, acharPlano('essencial'))).toBe(1.5)
  })
})

describe('comoTamanho', () => {
  it('fala em MB, com vírgula, como o resto do painel', () => {
    expect(comoTamanho(3.4 * 1024 * 1024)).toBe('3,4 MB')
    expect(comoTamanho(23816450)).toBe('23 MB')
  })

  /*
   * Zero para um arquivo que existe parece defeito, e foi o motivo de a régua
   * ter casa decimal embaixo.
   */
  it('não some com arquivo pequeno', () => {
    expect(comoTamanho(120 * 1024)).toBe('0,1 MB')
  })

  it('sobe para GB quando passa de mil MB', () => {
    expect(comoTamanho(2.5 * 1024 * 1024 * 1024)).toBe('2,5 GB')
  })

  it('trata vazio e lixo sem quebrar a tela', () => {
    expect(comoTamanho(0)).toBe('0 MB')
    expect(comoTamanho(-5)).toBe('0 MB')
    expect(comoTamanho(Number.NaN)).toBe('0 MB')
  })
})

describe('o anual do plano', () => {
  it('pague 10, leve 12: 17% a menos, arredondado ao real por mês', () => {
    expect(anualDoPlano({ preco: 597, precoAnual: 5970 })).toEqual({ porMes: 498, porAno: 5970, desconto: 17 })
  })

  it('sem anual, ou anual que não sai mais barato, não anuncia desconto', () => {
    expect(anualDoPlano({ preco: 597, precoAnual: null })).toBeNull()
    expect(anualDoPlano({ preco: 597, precoAnual: 597 * 12 })).toBeNull()
  })

  it('todo plano do código tem anual mais barato que doze mensalidades', () => {
    for (const plano of PLANOS) expect(anualDoPlano(plano)).not.toBeNull()
  })
})

describe('custoDaEquipe', () => {
  const essencial = PLANOS[0]!

  it('não cobra nada até a equipe inclusa', () => {
    expect(custoDaEquipe(essencial, 3)).toEqual({ extras: 0, valor: 0, enterprise: false })
  })

  it('cobra cada pessoa acima, pelo extra do plano', () => {
    expect(custoDaEquipe(essencial, 5)).toEqual({ extras: 2, valor: 138, enterprise: false })
  })

  it('acima de 50 pessoas é conversa de Enterprise', () => {
    expect(custoDaEquipe(essencial, 51).enterprise).toBe(true)
    expect(custoDaEquipe(essencial, 50).enterprise).toBe(false)
  })
})

describe('tetoDeIaDaConta', () => {
  it('é o número do plano com a chave da 4YU', () => {
    expect(PLANOS.map((p) => tetoDeIaDaConta(p))).toEqual([1500, 3000, 6000])
  })

  it('some com chave própria: quem paga a IA é o cliente', () => {
    expect(tetoDeIaDaConta(PLANOS[0]!, true)).toBeNull()
  })
})
