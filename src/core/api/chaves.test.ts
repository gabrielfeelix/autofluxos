import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  base62,
  chaveMascarada,
  ehEscopoDaApi,
  lerChave,
  montarChave,
  quandoFoiUsada,
  sortearPublico,
  sortearSegredo,
  tokenDoCabecalho,
} from './chaves'

const aleatorio = (n: number) => new Uint8Array(randomBytes(n))

describe('a chave da API', () => {
  it('ida e volta: o que se monta se lê', () => {
    const publico = sortearPublico(aleatorio)
    const segredo = sortearSegredo(aleatorio)
    expect(publico).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(segredo).toMatch(/^[A-Za-z0-9]{43}$/)
    expect(lerChave(montarChave(publico, segredo))).toEqual({ publico, segredo })
  })

  it('segredo com bytes zerados ainda tem 43 caracteres', () => {
    expect(sortearSegredo((n) => new Uint8Array(n))).toHaveLength(43)
  })

  it('base62 de 32 bytes no máximo cabe em 43', () => {
    expect(base62(new Uint8Array(32).fill(255)).length).toBe(43)
  })

  it('recusa o que não tem a forma de uma chave nossa', () => {
    const segredo = 'a'.repeat(43)
    expect(lerChave(`sk_live_ABCDEFGHIJKL_${segredo}`)).toBeNull()
    expect(lerChave(`af_live_ABCDEFGHIJK_${segredo}`)).toBeNull()
    expect(lerChave(`af_live_ABCDEFGHIJKL_${segredo.slice(1)}`)).toBeNull()
    expect(lerChave(`af_live_ABCDEFGHIJKL_${segredo.slice(1)}-`)).toBeNull()
    expect(lerChave(`af_live_ABCDEFGHIJKL-${segredo}`)).toBeNull()
  })

  it('a máscara nunca mostra o segredo', () => {
    expect(chaveMascarada('ABCDEFGHIJKL', 'wxyz')).toBe('af_live_ABCDEFGHIJKL_••••wxyz')
  })

  it('lê só Bearer, com um token', () => {
    expect(tokenDoCabecalho('Bearer abc')).toBe('abc')
    expect(tokenDoCabecalho('bearer  abc ')).toBe('abc')
    expect(tokenDoCabecalho('Basic abc')).toBeNull()
    expect(tokenDoCabecalho('Bearer a b')).toBeNull()
    expect(tokenDoCabecalho(null)).toBeNull()
  })

  it('escopo é lista fechada', () => {
    expect(ehEscopoDaApi('contatos:ler')).toBe(true)
    expect(ehEscopoDaApi('admin')).toBe(false)
  })

  it('diz há quanto tempo foi usada', () => {
    const agora = new Date('2026-10-02T12:00:00Z')
    expect(quandoFoiUsada(null, agora)).toBe('nunca usada')
    expect(quandoFoiUsada('2026-10-02T11:55:00Z', agora)).toBe('usada há 5 min')
    expect(quandoFoiUsada('2026-09-30T12:00:00Z', agora)).toBe('usada há 2 dias')
  })
})
