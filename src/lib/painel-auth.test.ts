import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DURACAO_SESSAO_SEGUNDOS,
  conferirSessao,
  criarSessao,
  iguais,
  segredoDeSessao,
} from './painel-auth'

const SEGREDO = 'segredo de assinatura do teste'
const AGORA = Date.UTC(2026, 7, 14, 12, 0, 0)
const UM_SEGUNDO = 1_000

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sessão do painel', () => {
  it('emite uma sessão que ela mesma aceita', async () => {
    const cookie = await criarSessao(SEGREDO, AGORA)
    expect(await conferirSessao(cookie, SEGREDO, AGORA)).toBe(true)
  })

  it('cada login é uma sessão diferente', async () => {
    const primeira = await criarSessao(SEGREDO, AGORA)
    const segunda = await criarSessao(SEGREDO, AGORA)

    // O cookie antigo era o mesmo valor para todo mundo, para sempre. Dois
    // logins iguais significam que não existe "esta sessão" para revogar depois.
    expect(primeira).not.toBe(segunda)
    expect(await conferirSessao(primeira, SEGREDO, AGORA)).toBe(true)
    expect(await conferirSessao(segunda, SEGREDO, AGORA)).toBe(true)
  })

  it('recusa depois do prazo, mesmo com o navegador guardando o cookie', async () => {
    const cookie = await criarSessao(SEGREDO, AGORA)
    const fimDoPrazo = AGORA + DURACAO_SESSAO_SEGUNDOS * 1_000

    expect(await conferirSessao(cookie, SEGREDO, fimDoPrazo - UM_SEGUNDO)).toBe(true)
    expect(await conferirSessao(cookie, SEGREDO, fimDoPrazo)).toBe(false)
    expect(await conferirSessao(cookie, SEGREDO, fimDoPrazo + UM_SEGUNDO)).toBe(false)
  })

  it('esticar o prazo no cookie quebra a assinatura', async () => {
    const cookie = await criarSessao(SEGREDO, AGORA)
    const [id, expira, assinatura] = cookie.split('.')
    const esticado = `${id}.${Number(expira) + 60 * 60 * 24 * 365}.${assinatura}`

    expect(await conferirSessao(esticado, SEGREDO, AGORA)).toBe(false)
  })

  it('trocar o id ou a assinatura não passa', async () => {
    const cookie = await criarSessao(SEGREDO, AGORA)
    const [id, expira, assinatura] = cookie.split('.')

    expect(await conferirSessao(`${'0'.repeat(32)}.${expira}.${assinatura}`, SEGREDO, AGORA)).toBe(false)
    expect(await conferirSessao(`${id}.${expira}.${'0'.repeat(64)}`, SEGREDO, AGORA)).toBe(false)
  })

  it('trocar o segredo encerra todas as sessões existentes', async () => {
    const cookie = await criarSessao(SEGREDO, AGORA)

    expect(await conferirSessao(cookie, SEGREDO, AGORA)).toBe(true)
    expect(await conferirSessao(cookie, 'segredo novo', AGORA)).toBe(false)
  })

  it('recusa cookie fora do formato sem estourar', async () => {
    for (const lixo of ['', 'qualquer coisa', 'a.b', 'a.b.c.d', '../../etc/passwd']) {
      expect(await conferirSessao(lixo, SEGREDO, AGORA)).toBe(false)
    }
  })

  it('sem PAINEL_SEGREDO o segredo é derivado da senha, e nunca é a senha', () => {
    vi.stubEnv('PAINEL_SEGREDO', '')
    const derivado = segredoDeSessao('senha do painel')

    expect(derivado).not.toBe('senha do painel')
    expect(derivado).toBe(segredoDeSessao('senha do painel'))
    expect(derivado).not.toBe(segredoDeSessao('outra senha'))
  })

  it('com PAINEL_SEGREDO configurado, trocar a senha não derruba as sessões', () => {
    vi.stubEnv('PAINEL_SEGREDO', 'segredo próprio')

    expect(segredoDeSessao('senha antiga')).toBe(segredoDeSessao('senha nova'))
  })

  it('compara credenciais exatamente', () => {
    expect(iguais('correta', 'correta')).toBe(true)
    expect(iguais('correta', 'errada!')).toBe(false)
    expect(iguais('curta', 'mais longa')).toBe(false)
  })
})
