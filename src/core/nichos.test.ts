import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODELOS } from '@/exemplos/modelos'
import { OBJETIVOS } from './objetivo-da-conta'
import {
  NICHOS,
  PACOTES,
  VISOES_DO_CATALOGO,
  destaqueDeFluxos,
  destaqueDeFunis,
  ehNicho,
  pacoteDo,
  rotuloNaBarra,
  MODELOS_DE_QUALQUER_RAMO,
  FUNIS_DE_QUALQUER_RAMO,
  separarPeloRamo,
  visaoDoCatalogo,
} from './nichos'
import { MODELOS_DE_QUADRO } from './quadros-modelos'

describe('o ramo da conta', () => {
  it('sem ramo não há pacote: é o sistema de hoje', () => {
    expect(pacoteDo(null)).toBeNull()
    expect(pacoteDo(undefined)).toBeNull()
  })

  it('reconhece só os ramos que existem', () => {
    for (const nicho of NICHOS) expect(ehNicho(nicho)).toBe(true)
    for (const outro of ['', 'saude', 'Restaurante', null, undefined, 1]) expect(ehNicho(outro)).toBe(false)
  })

  it('todo ramo tem pacote, com objetivo que existe e nome escrito', () => {
    for (const nicho of NICHOS) {
      const pacote = PACOTES[nicho]
      expect(OBJETIVOS).toContain(pacote.objetivoSugerido)
      expect(pacote.nome.trim()).not.toBe('')
      for (const rotulo of Object.values(pacote.rotulos)) expect(rotulo.trim(), nicho).not.toBe('')
    }
  })

  it('ramo que mostra cardápio em arquivo ou grade não esconde a lista de produtos', () => {
    for (const nicho of NICHOS) {
      const pacote = PACOTES[nicho]
      if (pacote.materiais || pacote.visaoDoCatalogo === 'grade') expect(pacote.ocultos, nicho).not.toContain('catalogo')
    }
  })

  it('só a lista de produtos e as integrações da loja podem sumir: o resto é trabalho de todo ramo', () => {
    for (const nicho of NICHOS) for (const lugar of PACOTES[nicho].ocultos) expect(['catalogo', 'conectar-loja']).toContain(lugar)
  })

  it('rotuloNaBarra usa o nome do ramo, e o de sempre sem ramo', () => {
    expect(rotuloNaBarra(null, 'contatos', 'Contatos')).toBe('Contatos')
    expect(rotuloNaBarra(PACOTES.aulas, 'contatos', 'Contatos')).toBe('Alunos')
    expect(rotuloNaBarra(PACOTES.aulas, 'segmentos', 'Segmentos')).toBe('Segmentos')
  })

  it('todo ramo abre o catálogo numa visão que existe', () => {
    for (const nicho of NICHOS) expect(VISOES_DO_CATALOGO).toContain(PACOTES[nicho].visaoDoCatalogo)
  })
})

describe('os modelos do ramo', () => {
  it('todo modelo de fluxo citado existe na galeria', () => {
    const ids = MODELOS.map((modelo) => modelo.id)
    for (const nicho of NICHOS) {
      expect(PACOTES[nicho].modelosDeFluxo.length, nicho).toBeGreaterThan(0)
      for (const id of PACOTES[nicho].modelosDeFluxo) expect(ids, `${nicho}: ${id}`).toContain(id)
    }
  })

  it('todo funil citado existe entre os modelos de funil', () => {
    const ids = MODELOS_DE_QUADRO.map((modelo) => modelo.id)
    for (const nicho of NICHOS) expect(ids, nicho).toContain(PACOTES[nicho].modeloDeFunil)
  })

  it('nenhum ramo destaca o modelo em branco: ele é o botão "Em branco"', () => {
    for (const nicho of NICHOS) expect(PACOTES[nicho].modelosDeFluxo).not.toContain('vazio')
  })

  it('sem ramo não há destaque, e a galeria é a de sempre', () => {
    expect(destaqueDeFluxos(null)).toBeNull()
    expect(destaqueDeFunis(null)).toBeNull()
    const lista = [{ id: 'a' }, { id: 'b' }]
    expect(separarPeloRamo(lista, null)).toEqual({ doRamo: [], outros: lista })
  })

  it('o destaque vem na ordem do pacote, e os outros na de sempre', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const { doRamo, outros } = separarPeloRamo(lista, { titulo: 'Para teste', ids: ['c', 'a', 'sumiu'], tambem: ['d', 'a', 'b'] })
    expect(doRamo.map((m) => m.id)).toEqual(['c', 'a'])
    // "a" já é do ramo e não repete; o que não está em nenhum grupo não entra.
    expect(outros.map((m) => m.id)).toEqual(['b', 'd'])
  })

  it('os modelos de qualquer negócio existem', () => {
    for (const id of MODELOS_DE_QUALQUER_RAMO) expect(MODELOS.map((m) => m.id)).toContain(id)
    for (const id of FUNIS_DE_QUALQUER_RAMO) expect(MODELOS_DE_QUADRO.map((m) => m.id)).toContain(id)
  })

  it('a conta com ramo vê só os modelos dele e os de qualquer negócio', () => {
    for (const nicho of NICHOS) {
      const { doRamo, outros } = separarPeloRamo(MODELOS, destaqueDeFluxos(PACOTES[nicho]))
      expect(doRamo.map((m) => m.id)).toEqual(PACOTES[nicho].modelosDeFluxo)
      for (const modelo of outros) expect(MODELOS_DE_QUALQUER_RAMO as readonly string[]).toContain(modelo.id)
      const funis = separarPeloRamo(MODELOS_DE_QUADRO, destaqueDeFunis(PACOTES[nicho]))
      expect(funis.doRamo.map((m) => m.id)).toEqual([PACOTES[nicho].modeloDeFunil])
    }
  })
})

describe('a visão do catálogo', () => {
  it('sem ramo abre na lista, como sempre abriu', () => {
    expect(visaoDoCatalogo(null)).toBe('lista')
  })

  it('o ramo escolhe a primeira visão, e o endereço troca', () => {
    const grade = PACOTES[NICHOS.find((n) => PACOTES[n].visaoDoCatalogo === 'grade')!]
    expect(visaoDoCatalogo(grade)).toBe('grade')
    expect(visaoDoCatalogo(grade, 'lista')).toBe('lista')
    expect(visaoDoCatalogo(null, 'grade')).toBe('grade')
  })

  it('visão desconhecida no endereço cai na do ramo', () => {
    expect(visaoDoCatalogo(null, 'mosaico')).toBe('lista')
  })
})

/**
 * A regra de governança do PLANO-NICHOS (3.2): comportamento por ramo sai do
 * pacote, nunca de um `if (nicho === 'restaurante')` espalhado. Se este teste
 * falhar, a mudança certa é um campo novo em `PacoteDoNicho`.
 */
describe('o nome do ramo só aparece em core/nichos.ts', () => {
  const raiz = join(__dirname, '..')
  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome)
      return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho]
    })

  it('nenhum arquivo de src compara com o nome de um ramo', () => {
    const literal = new RegExp(`['"\`](${NICHOS.join('|')})['"\`]`)
    const culpados = arquivos(raiz)
      .filter((caminho) => /\.(ts|tsx)$/.test(caminho) && !/\.test\.tsx?$/.test(caminho))
      .filter((caminho) => !caminho.endsWith(join('core', 'nichos.ts')))
      .filter((caminho) => literal.test(readFileSync(caminho, 'utf8')))
      .map((caminho) => relative(raiz, caminho))
    expect(culpados).toEqual([])
  })
})
