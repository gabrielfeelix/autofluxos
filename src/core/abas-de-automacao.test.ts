import { describe, expect, it } from 'vitest'
import { consultaDaAba, resolverAba } from './abas-de-automacao'

describe('resolverAba', () => {
  it('Gatilhos abre Palavras-chave quando o tipo falta ou é estranho', () => {
    expect(resolverAba('gatilhos', undefined)).toEqual({ conteudo: 'palavras', principal: 'gatilhos' })
    expect(resolverAba('gatilhos', 'xyz')).toEqual({ conteudo: 'palavras', principal: 'gatilhos' })
    expect(resolverAba('gatilhos', 'campanhas')).toEqual({ conteudo: 'campanhas', principal: 'gatilhos' })
  })

  it('as URLs antigas continuam abrindo a mesma coisa', () => {
    expect(resolverAba('eventos', undefined)).toEqual({ conteudo: 'eventos', principal: 'gatilhos' })
    expect(resolverAba('templates', undefined)).toEqual({ conteudo: 'templates', principal: 'fluxos' })
  })

  it('aba desconhecida cai em Fluxos', () => {
    expect(resolverAba('qualquer', 'palavras')).toEqual({ conteudo: 'fluxos', principal: 'fluxos' })
    expect(resolverAba(undefined, undefined)).toEqual({ conteudo: 'fluxos', principal: 'fluxos' })
  })

  it('o endereço novo leva o tipo', () => {
    expect(consultaDaAba('eventos')).toBe('aba=gatilhos&tipo=eventos')
    expect(consultaDaAba('sequencias')).toBe('aba=sequencias')
  })
})
