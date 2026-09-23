import { describe, expect, it } from 'vitest'
import { filtrarCatalogo, GRUPOS_DE_BLOCOS, NOMES } from './blocos'

describe('o catálogo de blocos agrupado', () => {
  it('os quatro grupos cobrem todos os blocos, cada um uma vez', () => {
    const noCatalogo = GRUPOS_DE_BLOCOS.flatMap((grupo) => grupo.tipos)
    expect([...noCatalogo].sort()).toEqual(Object.keys(NOMES).sort())
    expect(new Set(noCatalogo).size).toBe(noCatalogo.length)
  })

  it('a busca olha nome e descrição, sem acento', () => {
    expect(filtrarCatalogo('midia')).toEqual([{ nome: 'Conversar', tipos: ['midia'] }])
    // "funil" só aparece no nome e na descrição da etapa.
    expect(filtrarCatalogo('FUNIL')).toEqual([{ nome: 'Organizar', tipos: ['etapa'] }])
    expect(filtrarCatalogo('pessoa').flatMap((g) => g.tipos)).toContain('handoff')
  })

  it('busca vazia devolve tudo e busca sem resultado devolve nada', () => {
    expect(filtrarCatalogo('  ')).toBe(GRUPOS_DE_BLOCOS)
    expect(filtrarCatalogo('xyz')).toEqual([])
  })
})
