import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { TESTES_DE_INTEGRACAO } from './test/suites'

/**
 * A configuração unitária: sem `.env`, sem rede, sem banco.
 *
 * A diferença que importa em relação ao `vitest.config.ts` antigo é o que
 * **não** está aqui: nenhuma leitura de `.env`. Antes, todo teste recebia
 * `SUPABASE_URL` e `SUPABASE_SECRET_KEY` de produção só por existir um arquivo
 * na raiz, e bastava um teste decidir se conectar para escrever no banco que a
 * Verandi também usa.
 *
 * `test/rede-bloqueada.ts` fecha a outra metade: mesmo com endereço embutido no
 * código, a chamada não sai da máquina.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/stub-server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'test/e2e/**', 'test/integracao/**', ...TESTES_DE_INTEGRACAO],
    setupFiles: ['./test/rede-bloqueada.ts'],
    /**
     * Sem `.env`. Só o mínimo que o código puro espera encontrar definido.
     * Valores deliberadamente falsos: se algum teste unitário tentar usá-los
     * para falar com alguém, a rede bloqueada recusa e o teste falha alto.
     */
    env: {
      NODE_ENV: 'test',
      AUTOFLUXOS_AMBIENTE_DE_TESTE: 'unitario',
    },
    testTimeout: 5_000,
    hookTimeout: 5_000,
  },
})
