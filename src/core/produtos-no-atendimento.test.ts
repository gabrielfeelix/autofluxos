import { describe, expect, it } from 'vitest'
import {
  origemDoClique,
  PESSOA_SEM_NOME,
  resumirProdutosNoAtendimento,
  SEM_NOME_DO_PRODUTO,
} from './produtos-no-atendimento'

const ANA = '3f9a1c2e-0000-4000-8000-000000000001'
const BRUNO = '7b7b7b7b-0000-4000-8000-000000000002'
const LOJA = 'https://loja.test/cadeira'
const DO_ROBO = `${LOJA}?utm_source=whatsapp&utm_medium=chatbot&utm_campaign=autofluxos&utm_content=robo`
const DA_ANA = `${LOJA}?utm_source=whatsapp&utm_medium=atendimento&utm_campaign=autofluxos&utm_content=ana-souza-3f9a1c2e`

describe('origemDoClique', () => {
  it('lê robô e pessoa pelas UTMs', () => {
    expect(origemDoClique(DO_ROBO)).toEqual({ meio: 'robo', quem: 'robo' })
    expect(origemDoClique(DA_ANA)).toEqual({ meio: 'pessoa', quem: 'ana-souza-3f9a1c2e' })
  })

  it('link sem UTM, com UTM de outro lugar ou inválido não tem origem', () => {
    expect(origemDoClique(LOJA)).toEqual({ meio: null, quem: null })
    expect(origemDoClique(`${LOJA}?utm_medium=cpc`)).toEqual({ meio: null, quem: null })
    expect(origemDoClique('não é link')).toEqual({ meio: null, quem: null })
    expect(origemDoClique(null)).toEqual({ meio: null, quem: null })
  })
})

describe('resumirProdutosNoAtendimento', () => {
  it('sem nada, tudo zero e listas vazias', () => {
    expect(resumirProdutosNoAtendimento([], [])).toEqual({
      produtos: [],
      quem: [],
      cardsDoRobo: 0,
      cardsDePessoas: 0,
      cliques: 0,
    })
  })

  it('junta os cliques do mesmo produto e separa robô, pessoa e sem origem', () => {
    const r = resumirProdutosNoAtendimento(
      [
        { produto: 'Cadeira', link: DO_ROBO, n: 3 },
        { produto: 'Cadeira', link: DA_ANA, n: 2 },
        { produto: 'Cadeira', link: LOJA, n: 1 },
        { produto: 'Mouse', link: DO_ROBO, n: 7 },
        { produto: null, link: DO_ROBO, n: 1 },
      ],
      [],
    )
    expect(r.cliques).toBe(14)
    expect(r.produtos).toEqual([
      { nome: 'Mouse', cliques: 7, doRobo: 7, dePessoas: 0, semOrigem: 0 },
      { nome: 'Cadeira', cliques: 6, doRobo: 3, dePessoas: 2, semOrigem: 1 },
      { nome: SEM_NOME_DO_PRODUTO, cliques: 1, doRobo: 1, dePessoas: 0, semOrigem: 0 },
    ])
  })

  it('separa cards do robô dos de pessoas e ranqueia quem mais ofereceu', () => {
    const r = resumirProdutosNoAtendimento(
      [
        { produto: 'Cadeira', link: DO_ROBO, n: 4 },
        { produto: 'Cadeira', link: DA_ANA, n: 2 },
      ],
      [
        { tipo: 'automacao', usuarioId: null, nome: null, cards: 30 },
        { tipo: 'pessoa', usuarioId: ANA, nome: 'Ana Souza', cards: 3 },
        { tipo: 'pessoa', usuarioId: BRUNO, nome: 'Bruno', cards: 5 },
        // A Ana trocou de nome no meio do período: continua sendo ela.
        { tipo: 'pessoa', usuarioId: ANA, nome: 'Ana S.', cards: 1 },
      ],
    )
    expect(r.cardsDoRobo).toBe(30)
    expect(r.cardsDePessoas).toBe(9)
    expect(r.quem.map((q) => [q.nome, q.cards, q.cliques])).toEqual([
      ['Robô', 30, 4],
      ['Bruno', 5, 0],
      ['Ana Souza', 4, 2],
    ])
    expect(r.quem[0]!.robo).toBe(true)
  })

  it('card sem autor gravado conta como pessoa, sem inventar nome', () => {
    const r = resumirProdutosNoAtendimento([], [{ tipo: null, usuarioId: null, nome: null, cards: 2 }])
    expect(r.cardsDePessoas).toBe(2)
    expect(r.quem).toEqual([{ chave: `n:${PESSOA_SEM_NOME}`, nome: PESSOA_SEM_NOME, robo: false, cards: 2, cliques: 0 }])
  })

  it('robô com cliques mas sem card no período ainda aparece', () => {
    const r = resumirProdutosNoAtendimento([{ produto: 'Mouse', link: DO_ROBO, n: 2 }], [])
    expect(r.quem).toEqual([{ chave: 'robo', nome: 'Robô', robo: true, cards: 0, cliques: 2 }])
  })
})
