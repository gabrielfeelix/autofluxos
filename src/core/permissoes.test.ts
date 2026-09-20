import { describe, expect, it } from 'vitest'
import {
  alcanca,
  alcancaPeloMenos,
  CAPACIDADES,
  escopoDe,
  ehCapacidade,
  ehEscopo,
  filtroDe,
  MODELOS_EXTRA,
  pode,
  POLITICAS,
  type Acesso,
} from './permissoes'

/**
 * As regras de quem pode o quê (RB-40 a RB-42).
 *
 * O que estes testes protegem, e que não se vê lendo o código: o **padrão é
 * negar**. Capacidade nova nasce `nenhum` para todo papel, e é preciso dizer
 * para abrir. O teste que prova isso é o primeiro, e ele é o que quebra no dia
 * em que alguém adicionar uma capacidade e a abrir sem querer.
 */

const dono: Acesso = { papel: 'owner', usuarioId: 'u-dono' }
const membro: Acesso = { papel: 'member', usuarioId: 'u-membro' }
const deFora: Acesso = { papel: null }

describe('o padrão é negar', () => {
  it('capacidade fora da política do papel vale nenhum', () => {
    // `member` não configura empresa: é a única coisa que ele já não podia, e
    // a política preserva isso em vez de reabrir.
    expect(escopoDe(membro, 'configurar_empresa')).toBe('nenhum')
    expect(pode(membro, 'configurar_empresa')).toBe(false)
  })

  it('quem não é membro não pode nada', () => {
    for (const capacidade of CAPACIDADES) {
      expect(escopoDe(deFora, capacidade)).toBe('nenhum')
      expect(pode(deFora, capacidade)).toBe(false)
    }
  })

  /**
   * **O teste que importa no futuro.**
   *
   * Toda capacidade precisa aparecer na política de todo papel — nem que seja
   * como `nenhum`. Se `politica()` deixasse de preencher o resto, uma
   * capacidade nova viria `undefined`, e `undefined` em comparação de escopo
   * não é negação: é erro silencioso.
   */
  it('toda capacidade tem escopo definido em todo papel', () => {
    for (const politica of Object.values(POLITICAS)) {
      for (const capacidade of CAPACIDADES) {
        expect(ehEscopo(politica[capacidade])).toBe(true)
      }
    }
    for (const modelo of Object.values(MODELOS_EXTRA)) {
      for (const capacidade of CAPACIDADES) {
        expect(ehEscopo(modelo[capacidade])).toBe(true)
      }
    }
  })
})

describe('o papel de compatibilidade', () => {
  /**
   * `member` preserva o acesso de hoje. É a exigência literal da proposta —
   * "não retirar acesso de operadores em massa sem prévia" — e o teste existe
   * para que endurecer a regra sem passar pela tela quebre aqui, e não na
   * conta de alguém.
   */
  it('member continua atendendo, vendendo e exportando', () => {
    expect(pode(membro, 'atender', 'todos')).toBe(true)
    expect(pode(membro, 'registrar_venda', 'todos')).toBe(true)
    expect(pode(membro, 'ler_valores', 'todos')).toBe(true)
    expect(pode(membro, 'exportar', 'todos')).toBe(true)
  })

  /**
   * As duas exceções, e elas não são "acesso atual": `configurar_empresa` já
   * era negada por `podeAdministrarConta`, e `corrigir_venda` mexe em número
   * fechado — ela nasce fechada porque a dúvida tem um lado seguro.
   */
  it('member não configura a empresa nem corrige venda', () => {
    expect(pode(membro, 'configurar_empresa')).toBe(false)
    expect(pode(membro, 'corrigir_venda')).toBe(false)
  })

  it('dono e admin podem tudo', () => {
    for (const capacidade of CAPACIDADES) {
      expect(pode(dono, capacidade, 'todos')).toBe(true)
      expect(pode({ papel: 'admin' }, capacidade, 'todos')).toBe(true)
    }
  })
})

describe('os modelos da RB-40', () => {
  it('o operador não toca dinheiro nem exportação', () => {
    const operador: Acesso = {
      papel: 'member',
      usuarioId: 'u-op',
      sobrescritas: MODELOS_EXTRA.operador,
    }

    expect(pode(operador, 'atender')).toBe(true)
    expect(pode(operador, 'criar_oportunidade')).toBe(true)

    // É o A27: atende sem inferir valores.
    expect(pode(operador, 'ler_valores')).toBe(false)
    expect(pode(operador, 'registrar_venda')).toBe(false)
    expect(pode(operador, 'exportar')).toBe(false)
  })

  it('o gestor trabalha no escopo da equipe, não no de todos', () => {
    const gestor: Acesso = {
      papel: 'member',
      usuarioId: 'u-gestor',
      equipes: ['eq-a'],
      sobrescritas: MODELOS_EXTRA.gestor,
    }

    expect(escopoDe(gestor, 'atender')).toBe('equipe')
    expect(pode(gestor, 'atender', 'equipe')).toBe(true)
    // Ter a capacidade no escopo da equipe não é tê-la sobre todos.
    expect(pode(gestor, 'atender', 'todos')).toBe(false)
  })
})

describe('a sobrescrita vale por cima do papel', () => {
  /**
   * É o que deixa "operador que também registra venda" existir sem criar papel
   * novo — e sem que a exceção de uma conta vire regra para as outras.
   */
  it('abre uma capacidade que o papel negava', () => {
    const comExcecao: Acesso = {
      papel: 'member',
      usuarioId: 'u',
      sobrescritas: { corrigir_venda: 'proprios' },
    }
    expect(pode(comExcecao, 'corrigir_venda')).toBe(true)
    // E não vaza para as outras: continua sendo `member` no resto.
    expect(pode(comExcecao, 'configurar_empresa')).toBe(false)
  })

  it('fecha uma capacidade que o papel dava', () => {
    const restrito: Acesso = {
      papel: 'member',
      usuarioId: 'u',
      sobrescritas: { ler_valores: 'nenhum' },
    }
    expect(pode(restrito, 'ler_valores')).toBe(false)
    expect(pode(restrito, 'atender')).toBe(true)
  })

  it('a sobrescrita não alcança o administrador da plataforma', () => {
    // Ele passa por tudo, e essa decisão mora em `sessao.ts`. Uma sobrescrita
    // que o restringisse criaria dois lugares para mudá-la.
    const adminDa4yu: Acesso = {
      papel: null,
      ehAdminDaPlataforma: true,
      sobrescritas: { atender: 'nenhum' },
    }
    expect(pode(adminDa4yu, 'atender', 'todos')).toBe(true)
  })
})

describe('alcançar este registro', () => {
  const operador: Acesso = {
    papel: 'member',
    usuarioId: 'u-op',
    equipes: ['eq-a'],
    sobrescritas: { atender: 'proprios' },
  }

  it('próprios alcança o que é dele, e só', () => {
    expect(alcanca(operador, 'atender', { dono: 'u-op' })).toBe(true)
    expect(alcanca(operador, 'atender', { dono: 'u-outro' })).toBe(false)
  })

  /**
   * **A fila sem responsável não é de todos por acidente** (RB-40).
   *
   * Registro sem dono é o caso mais fácil de errar: o `if (dono === eu)`
   * ingênuo responde `undefined === 'u-op'`, que é falso — mas um
   * `if (!dono || dono === eu)` escrito por reflexo abriria a fila inteira.
   */
  it('registro sem dono não é de ninguém', () => {
    expect(alcanca(operador, 'atender', { dono: null })).toBe(false)
    expect(alcanca(operador, 'atender', {})).toBe(false)
  })

  it('equipe alcança a equipe dele, não a outra', () => {
    const gestor: Acesso = {
      papel: 'member',
      usuarioId: 'u-g',
      equipes: ['eq-a'],
      sobrescritas: { atender: 'equipe' },
    }
    expect(alcanca(gestor, 'atender', { equipe: 'eq-a' })).toBe(true)
    expect(alcanca(gestor, 'atender', { equipe: 'eq-b' })).toBe(false)
    // Sem equipe no registro, escopo de equipe não alcança — mesma razão do
    // teste acima.
    expect(alcanca(gestor, 'atender', { equipe: null })).toBe(false)
  })

  it('todos alcança qualquer registro, inclusive o sem dono', () => {
    expect(alcanca(dono, 'atender', { dono: null, equipe: null })).toBe(true)
    expect(alcanca(dono, 'atender', { dono: 'u-outro', equipe: 'eq-z' })).toBe(true)
  })

  it('sem a capacidade, não alcança nem o próprio', () => {
    const semNada: Acesso = { papel: 'member', usuarioId: 'u', sobrescritas: { atender: 'nenhum' } }
    expect(alcanca(semNada, 'atender', { dono: 'u' })).toBe(false)
  })
})

describe('o filtro que a consulta aplica antes de paginar', () => {
  /**
   * O filtro existe para que "quais registros" não vire `filter()` em memória
   * depois de ler tudo: isso entrega dados ao processo que não deveria tê-los
   * e conta errado qualquer total (A19).
   */
  it('todos vira tudo, e próprios vira o id da pessoa', () => {
    expect(filtroDe(dono, 'atender')).toEqual({ tipo: 'tudo' })
    expect(
      filtroDe({ papel: 'member', usuarioId: 'u', sobrescritas: { atender: 'proprios' } }, 'atender'),
    ).toEqual({ tipo: 'proprios', usuarioId: 'u' })
  })

  it('sem capacidade a consulta é impossível, e não uma lista vazia', () => {
    // A diferença importa: `impossivel` manda pular a ida ao banco. Uma lista
    // vazia viraria `in ()`, que o Postgres recusa.
    expect(filtroDe(deFora, 'atender')).toEqual({ tipo: 'impossivel' })
  })

  it('escopo de equipe sem equipe nenhuma é impossível', () => {
    const semEquipe: Acesso = {
      papel: 'member',
      usuarioId: 'u',
      equipes: [],
      sobrescritas: { atender: 'equipe' },
    }
    expect(filtroDe(semEquipe, 'atender')).toEqual({ tipo: 'impossivel' })
  })

  it('escopo de próprios sem id de usuário é impossível', () => {
    const semId: Acesso = { papel: 'member', sobrescritas: { atender: 'proprios' } }
    expect(filtroDe(semId, 'atender')).toEqual({ tipo: 'impossivel' })
  })
})

describe('as peças de tipo', () => {
  it('reconhecem o que é válido e recusam o resto', () => {
    expect(ehCapacidade('atender')).toBe(true)
    expect(ehCapacidade('atendr')).toBe(false)
    expect(ehEscopo('equipe')).toBe(true)
    expect(ehEscopo('Equipe')).toBe(false)
  })

  it('a ordem do alcance é a esperada', () => {
    expect(alcancaPeloMenos('todos', 'proprios')).toBe(true)
    expect(alcancaPeloMenos('proprios', 'todos')).toBe(false)
    expect(alcancaPeloMenos('equipe', 'equipe')).toBe(true)
    expect(alcancaPeloMenos('nenhum', 'proprios')).toBe(false)
  })

  /** `minimo: 'nenhum'` é "não exijo nada", e precisa passar para qualquer um. */
  it('exigir nenhum passa até para quem não é membro', () => {
    expect(pode(deFora, 'atender', 'nenhum')).toBe(true)
  })
})
