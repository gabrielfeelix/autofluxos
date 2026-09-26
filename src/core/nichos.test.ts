import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OBJETIVOS } from './objetivo-da-conta'
import { NICHOS, PACOTES, VISOES_DO_CATALOGO, ehNicho, pacoteDo, visaoDoCatalogo } from './nichos'

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
      expect(pacote.secaoComercio.trim()).not.toBe('')
    }
  })

  it('nenhum ramo esconde a lista de produtos: é o que o bot consulta', () => {
    for (const nicho of NICHOS) expect(PACOTES[nicho].itensOcultos).not.toContain('catalogo')
  })

  it('todo ramo abre o catálogo numa visão que existe', () => {
    for (const nicho of NICHOS) expect(VISOES_DO_CATALOGO).toContain(PACOTES[nicho].visaoDoCatalogo)
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
