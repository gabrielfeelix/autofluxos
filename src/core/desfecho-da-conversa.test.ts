import { describe, expect, it } from 'vitest'
import {
  desfechoDe,
  SEM_CONVERSAS,
  taxaDeAutomacao,
  taxaDeFalha,
  terminadas,
  total,
  type ContagemPorDesfecho,
} from './desfecho-da-conversa'

/**
 * O cenário que falha com a conta antiga, e é o da T8.2:
 *
 * a clínica tem um fluxo que responde horário e endereço, e termina em "falar
 * com a recepção" para quem quer remarcar. Num mês de 100 conversas: 40 o bot
 * resolveu, 50 foram para a recepção porque o fluxo manda, 5 caíram em alguém
 * porque a integração da agenda estava fora, e 5 ainda estão acontecendo.
 *
 * O painel antigo dizia "o bot resolveu 40%", e o dono concluía que a automação
 * era ruim. Das 60 que não foram "resolvidas pelo bot", 50 eram o produto
 * funcionando exatamente como desenhado e 5 eram defeito de produção que
 * ninguém foi olhar, porque estavam misturadas.
 */
function cenarioDaClinica(): ContagemPorDesfecho {
  return { bot: 40, prevista: 50, falha: 5, aberta: 5 }
}

describe('o desfecho de uma conversa', () => {
  it('encerrada sem passar por gente é do bot', () => {
    expect(desfechoDe({ status: 'encerrada' })).toBe('bot')
    expect(desfechoDe({ status: 'encerrada', origem: null })).toBe('bot')
  })

  it('transferência que o fluxo previu não é falha', () => {
    expect(desfechoDe({ status: 'humano', origem: 'prevista' })).toBe('prevista')
    expect(desfechoDe({ status: 'atendida_por_pessoa', origem: 'prevista' })).toBe('prevista')
  })

  it('transferência por falha é falha', () => {
    expect(desfechoDe({ status: 'humano', origem: 'falha' })).toBe('falha')
    expect(desfechoDe({ status: 'atendida_por_pessoa', origem: 'falha' })).toBe('falha')
  })

  it('conversa atendida por pessoa não some da conta', () => {
    // O defeito antigo: `acumular` somava `encerrada` e `humano` e ignorava
    // `atendida_por_pessoa`. Ela entrava no total e em fatia nenhuma, e as
    // partes não fechavam com o todo.
    expect(desfechoDe({ status: 'atendida_por_pessoa', origem: 'prevista' })).not.toBe('aberta')
  })

  it('handoff antigo, sem origem gravada, conta como falha', () => {
    // A escolha é deliberada, e o comentário do módulo diz por quê: chamar de
    // prevista inflaria "está tudo bem" com o que pode ter sido defeito.
    expect(desfechoDe({ status: 'humano' })).toBe('falha')
    expect(desfechoDe({ status: 'humano', origem: null })).toBe('falha')
  })

  it('conversa em andamento fica em aberto, e não vira resolvida de ninguém', () => {
    expect(desfechoDe({ status: 'ativa' })).toBe('aberta')
    // Status que ainda não existe também: contar um desfecho desconhecido como
    // resolvido é a tela afirmando o que não sabe.
    expect(desfechoDe({ status: 'pausada_por_algo_novo' })).toBe('aberta')
  })
})

describe('as taxas', () => {
  it('a taxa de automação divide pelo que terminou, e não pelo total', () => {
    const c = cenarioDaClinica()
    // 40 de 95 terminadas, e não 40 de 100: as 5 em aberto ainda podem terminar
    // de qualquer jeito. Dividir por tudo faria a taxa cair todo começo de mês.
    expect(taxaDeAutomacao(c)).toBe(42)
    expect(terminadas(c)).toBe(95)
    expect(total(c)).toBe(100)
  })

  it('a taxa de falha é separada, e não o complemento da de automação', () => {
    const c = cenarioDaClinica()
    // 5 de 95. Se fosse `100 - 42`, daria 58, que juntaria de volta as 50
    // transferências previstas: 58% de "problema" numa operação saudável.
    expect(taxaDeFalha(c)).toBe(5)
    expect(taxaDeFalha(c)).not.toBe(100 - (taxaDeAutomacao(c) ?? 0))
  })

  it('sem nada terminado a taxa é nula, e não zero', () => {
    // Zero seria "terminaram e o bot não resolveu nenhuma", que é um mês ruim
    // de verdade. Mostrar zero numa conta nova a faz parecer quebrada (RB-06).
    expect(taxaDeAutomacao(SEM_CONVERSAS)).toBeNull()
    expect(taxaDeFalha(SEM_CONVERSAS)).toBeNull()
    expect(taxaDeAutomacao({ bot: 0, prevista: 0, falha: 0, aberta: 7 })).toBeNull()
  })

  it('zero de verdade continua sendo zero', () => {
    const c: ContagemPorDesfecho = { bot: 0, prevista: 3, falha: 2, aberta: 0 }
    expect(taxaDeAutomacao(c)).toBe(0)
    expect(taxaDeFalha(c)).toBe(40)
  })

  it('as fatias fecham com o total, sempre', () => {
    // A propriedade que faz o painel ser conferível: quem somar as colunas tem
    // que chegar no número grande.
    const c = cenarioDaClinica()
    expect(c.bot + c.prevista + c.falha + c.aberta).toBe(total(c))
  })
})
