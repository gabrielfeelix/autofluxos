import { describe, expect, it } from 'vitest'
import type { ValorDeCampo } from './campos'
import {
  avaliar,
  passarAoHumano,
  prontoParaPublicar,
  type Condicao,
  type Criterios,
} from './qualificacao'

/**
 * A diferença entre "não atende" e "ainda não sei", que é a razão de haver
 * quatro resultados e não um booleano.
 *
 * Quem não atende recebe material; quem tem dado faltando recebe uma pergunta.
 * Um sistema que chama as duas de "não qualificado" manda material para quem
 * estava a uma resposta de virar cliente.
 */
const campo = (valor: string): ValorDeCampo => ({
  valor,
  origem: 'contato',
  autorId: null,
  em: '2026-09-19T10:00:00Z',
})

const criterios = (modo: 'todas' | 'qualquer', condicoes: Condicao[]): Criterios => ({
  id: 'crit-1',
  versao: 3,
  objetivo: 'Plano XYZ',
  modo,
  condicoes,
})

describe('avaliar, no modo "todas"', () => {
  const regra = criterios('todas', [
    { campo: 'orcamento', operador: 'maior', valor: '500' },
    { campo: 'cidade', operador: 'igual', valor: 'Maringá' },
  ])

  it('todas verdadeiras: atende', () => {
    const r = avaliar(regra, { orcamento: campo('900'), cidade: campo('Maringá') })
    expect(r.resultado).toBe('atende')
    expect(r.faltam).toEqual([])
  })

  it('uma falsa: não atende, com o motivo e o valor que estava lá', () => {
    const r = avaliar(regra, { orcamento: campo('300'), cidade: campo('Maringá') })
    expect(r.resultado).toBe('nao_atende')
    expect(r.motivos[0]).toContain('300')
    expect(r.motivos[0]).toContain('500')
  })

  it('faltando dado que pode decidir: incompleto, dizendo qual', () => {
    const r = avaliar(regra, { orcamento: campo('900') })
    expect(r.resultado).toBe('incompleto')
    expect(r.faltam).toEqual(['cidade'])
  })

  /**
   * **A regra que a proposta escreve por último e que é a mais fácil de
   * errar:** só indicar dados incompletos quando os ausentes puderem mudar o
   * resultado. Com uma condição comprovadamente falsa em "todas", a resposta já
   * é não, e pedir os outros dados faria a pessoa trabalhar para chegar à mesma
   * conclusão.
   */
  it('uma falsa decide mesmo com as outras em branco', () => {
    const r = avaliar(regra, { orcamento: campo('100') })
    expect(r.resultado).toBe('nao_atende')
    expect(r.faltam).toEqual([])
  })
})

describe('avaliar, no modo "qualquer"', () => {
  const regra = criterios('qualquer', [
    { campo: 'orcamento', operador: 'maior', valor: '500' },
    { campo: 'indicacao', operador: 'preenchido' },
  ])

  it('uma verdadeira decide mesmo com as outras em branco', () => {
    const r = avaliar(regra, { orcamento: campo('900') })
    expect(r.resultado).toBe('atende')
    expect(r.faltam).toEqual([])
  })

  it('todas falsas: não atende', () => {
    const r = avaliar(regra, { orcamento: campo('100'), indicacao: campo('') })
    expect(r.resultado).toBe('nao_atende')
  })

  it('nenhuma verdadeira e uma em branco: incompleto', () => {
    const r = avaliar(criterios('qualquer', [
      { campo: 'orcamento', operador: 'maior', valor: '500' },
      { campo: 'cidade', operador: 'igual', valor: 'Maringá' },
    ]), { orcamento: campo('100') })
    expect(r.resultado).toBe('incompleto')
    expect(r.faltam).toEqual(['cidade'])
  })
})

describe('falso não é desconhecido', () => {
  /**
   * Campo em branco comparado com número responde `desconhecido`, nunca
   * `false`. Responder `false` afirmaria que a pessoa tem menos de 500 quando
   * ela apenas não respondeu ainda.
   */
  it('campo vazio não vira condição falsa', () => {
    const r = avaliar(criterios('todas', [{ campo: 'orcamento', operador: 'maior', valor: '500' }]), {})
    expect(r.resultado).toBe('incompleto')
    expect(r.resultado).not.toBe('nao_atende')
  })

  it('só espaços também é desconhecido', () => {
    const r = avaliar(criterios('todas', [{ campo: 'cidade', operador: 'igual', valor: 'Maringá' }]), {
      cidade: campo('   '),
    })
    expect(r.resultado).toBe('incompleto')
  })

  /** Texto onde se esperava número pede a pergunta de novo, não descarta. */
  it('texto num campo numérico é desconhecido, não falso', () => {
    const r = avaliar(criterios('todas', [{ campo: 'orcamento', operador: 'maior', valor: '500' }]), {
      orcamento: campo('não sei'),
    })
    expect(r.resultado).toBe('incompleto')
  })

  /** `preenchido` é a única que decide sobre a ausência, então ela decide. */
  it('preenchido responde sobre o vazio, e não fica em incompleto', () => {
    const r = avaliar(criterios('todas', [{ campo: 'email', operador: 'preenchido' }]), {})
    expect(r.resultado).toBe('nao_atende')
  })
})

describe('a versão dos critérios viaja com a avaliação', () => {
  /**
   * "Alterar critérios não reescreve avaliações passadas." Sem a versão junto,
   * mudar o critério faria o histórico inteiro passar a mentir, e ninguém teria
   * como explicar por que um lead foi recusado em março.
   */
  it('guarda id, versão e objetivo', () => {
    const r = avaliar(criterios('todas', [{ campo: 'cidade', operador: 'preenchido' }]), {
      cidade: campo('Maringá'),
    })
    expect(r.criteriosId).toBe('crit-1')
    expect(r.criteriosVersao).toBe(3)
    expect(r.objetivo).toBe('Plano XYZ')
  })

  /**
   * A mesma pessoa qualifica para um objetivo e não para outro, **sem alterar
   * o cadastro global dela**. É a verificação que a T4.2 pede, e é o oposto de
   * rotular a pessoa como desqualificada para tudo.
   */
  it('a mesma pessoa atende a um objetivo e não a outro', () => {
    const campos = { orcamento: campo('600'), cidade: campo('Maringá') }

    const basico: Criterios = { id: 'a', versao: 1, objetivo: 'Plano Básico', modo: 'todas', condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '500' }] }
    const premium: Criterios = { id: 'b', versao: 1, objetivo: 'Plano Premium', modo: 'todas', condicoes: [{ campo: 'orcamento', operador: 'maior', valor: '5000' }] }

    expect(avaliar(basico, campos).resultado).toBe('atende')
    expect(avaliar(premium, campos).resultado).toBe('nao_atende')

    // E os campos não foram tocados por nenhuma das duas avaliações.
    expect(campos.orcamento.valor).toBe('600')
  })
})

/**
 * RB-21: pedir para falar com uma pessoa não transforma a avaliação em
 * positiva.
 *
 * O modelo SDR fazia exatamente isto: o caminho "quero falar com alguém" caía
 * no mesmo nó de handoff rotulado `lead qualificado`, então quem pediu ajuda
 * saía marcado como qualificado sem nenhum critério ter sido conferido.
 */
describe('passarAoHumano', () => {
  it.each(['nao_atende', 'incompleto', 'nao_avaliado', 'atende'] as const)(
    'não altera o resultado %s',
    (resultado) => {
      const avaliacao = {
        resultado,
        motivos: [],
        faltam: [],
        criteriosId: 'c',
        criteriosVersao: 1,
        objetivo: 'X',
      }
      expect(passarAoHumano(avaliacao).resultado).toBe(resultado)
    },
  )
})

/**
 * RB-22: valores de demonstração não podem virar política real. É o que impede
 * o `orcamento > 499` do modelo SDR de virar a regra de uma empresa que nunca
 * escolheu esse número.
 */
describe('prontoParaPublicar', () => {
  it('regra completa publica', () => {
    expect(
      prontoParaPublicar(criterios('todas', [{ campo: 'orcamento', operador: 'maior', valor: '500' }])),
    ).toEqual({ pronto: true })
  })

  it('regra sem condição nenhuma não publica', () => {
    const r = prontoParaPublicar(criterios('todas', []))
    expect(r.pronto).toBe(false)
  })

  it('condição sem valor não publica, e diz qual', () => {
    const r = prontoParaPublicar(criterios('todas', [{ campo: 'orcamento', operador: 'maior' }]))
    expect(r.pronto).toBe(false)
    if (r.pronto) return
    expect(r.problemas[0]).toContain('orcamento')
  })

  it('comparar número com texto não publica', () => {
    const r = prontoParaPublicar(
      criterios('todas', [{ campo: 'orcamento', operador: 'maior', valor: 'bastante' }]),
    )
    expect(r.pronto).toBe(false)
  })

  /** `preenchido` não precisa de valor: ela pergunta sobre a existência. */
  it('preenchido publica sem valor', () => {
    expect(prontoParaPublicar(criterios('todas', [{ campo: 'email', operador: 'preenchido' }]))).toEqual({
      pronto: true,
    })
  })

  it('condição sem campo não publica', () => {
    const r = prontoParaPublicar(criterios('todas', [{ campo: '  ', operador: 'preenchido' }]))
    expect(r.pronto).toBe(false)
  })
})

/**
 * Regra vazia não aprova ninguém. Aprovar seria o pior default possível: uma
 * conta que ainda não configurou nada passaria a qualificar todo mundo.
 */
describe('critérios vazios', () => {
  it('respondem nao_avaliado, e não atende', () => {
    const r = avaliar(criterios('todas', []), { orcamento: campo('9000') })
    expect(r.resultado).toBe('nao_avaliado')
  })
})
