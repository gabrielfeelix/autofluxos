import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * A avaliação de IA (`src/server/ia/avaliacao/`): o modelo e a loja de
 * verdade, com rede, e nada mais.
 *
 * Fica fora do config unitário porque fala com a rede de propósito, e fora do
 * de integração porque não toca banco nenhum: os repositórios são mocks no
 * próprio teste. Ver o cabeçalho de `avaliacao.test.ts` para rodar.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/stub-server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/server/ia/avaliacao/**/*.test.ts'],
    env: { NODE_ENV: 'test', AUTOFLUXOS_AMBIENTE_DE_TESTE: 'unitario' },
    fileParallelism: false,
    testTimeout: 240_000,
  },
})
