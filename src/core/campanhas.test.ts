import { describe, expect, it } from 'vitest'
import { casarCampanha, fraseComparavel, type Campanha } from './campanhas'

/**
 * A campanha é a porta de entrada que o cliente está **pagando** para manter
 * aberta. Errar aqui não dá erro em lugar nenhum: o lead que veio do anúncio cai
 * no fluxo genérico, e o relatório do anúncio mostra zero.
 */
const campanha = (partes: Partial<Campanha> & { frase: string }): Campanha => ({
  id: partes.frase,
  nome: partes.frase,
  fluxoId: `fluxo-${partes.frase}`,
  ativa: true,
  execucoes: 0,
  ...partes,
})

describe('normalizar a frase', () => {
  it('tira a pontuação do fim, que é o que o WhatsApp às vezes come', () => {
    expect(fraseComparavel('Quero saber mais!')).toBe('quero saber mais')
    expect(fraseComparavel('Quero saber mais')).toBe('quero saber mais')
    expect(fraseComparavel('Quero saber mais?!')).toBe('quero saber mais')
  })

  it('tira acento, caixa e espaço repetido', () => {
    expect(fraseComparavel('  Quero  o PLANO trimestral ')).toBe('quero o plano trimestral')
    expect(fraseComparavel('Promoção de Março')).toBe('promocao de marco')
  })

  it('não tira pontuação do meio — ela faz parte da frase', () => {
    expect(fraseComparavel('Plano 2x1, por favor')).toBe('plano 2x1, por favor')
  })
})

describe('casar a campanha', () => {
  const campanhas = [
    campanha({ frase: 'Quero saber mais sobre o plano trimestral', fluxoId: 'trimestral' }),
    campanha({ frase: 'Vi o anúncio do studio', fluxoId: 'studio' }),
  ]

  it('casa a mensagem inteira, com ou sem a pontuação do fim', () => {
    expect(casarCampanha(campanhas, 'Quero saber mais sobre o plano trimestral')?.fluxoId).toBe(
      'trimestral',
    )
    expect(casarCampanha(campanhas, 'quero saber mais sobre o plano trimestral.')?.fluxoId).toBe(
      'trimestral',
    )
  })

  it('não casa com pedaço — quem apagou parte não está mais respondendo ao anúncio', () => {
    // É a diferença entre campanha e gatilho. Aqui, meia frase é outra conversa.
    expect(casarCampanha(campanhas, 'Quero saber mais')).toBeNull()
    expect(casarCampanha(campanhas, 'Oi! Quero saber mais sobre o plano trimestral')).toBeNull()
  })

  it('campanha desligada não decide nada', () => {
    const desligada = [campanha({ frase: 'Vi o anúncio do studio', ativa: false })]
    expect(casarCampanha(desligada, 'Vi o anúncio do studio')).toBeNull()
  })

  it('mensagem vazia não casa', () => {
    expect(casarCampanha(campanhas, '   ')).toBeNull()
  })
})
