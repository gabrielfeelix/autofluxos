import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * A configuração de integração: só contra banco local, e só com consentimento.
 *
 * Ela carrega `.env.teste-local` — **nunca** o `.env`, que guarda a credencial
 * de produção. O arquivo é separado justamente para que apontar a suíte para
 * produção exija escrever um endereço remoto à mão, em vez de acontecer por
 * herança.
 *
 * O `test/guarda-de-integracao.ts` confere o ambiente antes do primeiro teste e
 * derruba a suíte inteira se o endereço não for local. Ver `test/ambiente-local.ts`.
 */
function lerEnvDeTeste(): Record<string, string> {
  const caminho = fileURLToPath(new URL('./.env.teste-local', import.meta.url))
  if (!existsSync(caminho)) return {}

  const env: Record<string, string> = {}
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const limpa = linha.trim()
    if (limpa === '' || limpa.startsWith('#')) continue
    const corte = limpa.indexOf('=')
    if (corte === -1) continue
    env[limpa.slice(0, corte)] = limpa.slice(corte + 1)
  }
  return env
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/stub-server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.integracao.test.ts', 'test/integracao/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'test/e2e/**'],
    setupFiles: ['./test/guarda-de-integracao.ts'],
    env: { NODE_ENV: 'test', ...lerEnvDeTeste() },
    /** Banco local responde em milissegundos; não é a rede de sa-east-1. */
    testTimeout: 15_000,
    hookTimeout: 15_000,
    /**
     * Fixtures compartilham um banco só. Em paralelo, a limpeza de uma suíte
     * apaga o cenário da outra e a falha aparece longe da causa.
     */
    fileParallelism: false,
  },
})
