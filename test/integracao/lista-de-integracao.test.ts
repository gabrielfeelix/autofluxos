import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TESTES_DE_INTEGRACAO } from '../suites'

/**
 * A lista de `test/suites.ts` precisa continuar correspondendo ao código.
 *
 * O risco que isto fecha: alguém escreve um teste novo que fala com o banco,
 * esquece de pôr na lista, e ele passa a rodar na suíte **unitária**. Lá não há
 * `.env`, então ele se pula sozinho pelo `temCredencial` e passa verde para
 * sempre, sem nunca provar nada. Verde silencioso é pior que vermelho.
 */

const raiz = fileURLToPath(new URL('../..', import.meta.url))

/** Como os testes deste repositório decidem se falam com o banco. */
const MARCAS = ['temCredencial', 'temTudo', 'DATABASE_URL']

function usaCredencial(caminho: string): boolean {
  try {
    const fonte = readFileSync(new URL(caminho, `file://${raiz}`), 'utf8')
    return MARCAS.some((marca) => fonte.includes(marca))
  } catch {
    return false
  }
}

describe('a lista de testes de integração', () => {
  it('só contém arquivos que existem e realmente usam credencial', () => {
    for (const caminho of TESTES_DE_INTEGRACAO) {
      expect(usaCredencial(caminho), `${caminho} está na lista mas não usa credencial`).toBe(true)
    }
  })

  /**
   * A varredura ao contrário: nenhum teste fora da lista pode usar credencial.
   * Roda com `git ls-files` para não depender de caminhar o disco.
   */
  it('não deixa de fora nenhum teste que use credencial', async () => {
    const { execSync } = await import('node:child_process')
    const todos = execSync('git ls-files "src/**/*.test.ts"', { cwd: raiz, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)

    const foraDaLista = todos.filter(
      (caminho) => usaCredencial(caminho) && !(TESTES_DE_INTEGRACAO as readonly string[]).includes(caminho),
    )

    expect(
      foraDaLista,
      `estes testes falam com o banco e não estão em test/suites.ts:\n${foraDaLista.join('\n')}`,
    ).toEqual([])
  })
})
