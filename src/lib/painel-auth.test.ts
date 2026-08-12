import { describe, expect, it } from 'vitest'
import { iguais, tokenDaSenha } from './painel-auth'

describe('sessão do painel', () => {
  it('deriva um token estável sem expor a senha', async () => {
    const token = await tokenDaSenha('segredo de teste')
    expect(token).toBe(await tokenDaSenha('segredo de teste'))
    expect(token).not.toContain('segredo')
    expect(token).toHaveLength(64)
  })

  it('trocar a senha invalida o token anterior', async () => {
    expect(await tokenDaSenha('senha antiga')).not.toBe(await tokenDaSenha('senha nova'))
  })

  it('compara credenciais exatamente', () => {
    expect(iguais('correta', 'correta')).toBe(true)
    expect(iguais('correta', 'errada!')).toBe(false)
    expect(iguais('curta', 'mais longa')).toBe(false)
  })
})
