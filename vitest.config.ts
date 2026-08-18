import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Carrega o `.env` para os testes que falam com o Supabase de verdade.
 * Sem `.env`, esses testes se pulam sozinhos em vez de quebrar a suíte —
 * quem clona o repo consegue rodar `npm test` sem credencial nenhuma.
 */
function lerEnvLocal(): Record<string, string> {
  const caminho = fileURLToPath(new URL('./.env', import.meta.url))
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
      // `server-only` lança erro só de ser carregado fora do Next. Ver o stub.
      'server-only': fileURLToPath(new URL('./test/stub-server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    env: lerEnvLocal(),
    /**
     * O padrão do Vitest é 5s, que é orçamento de teste unitário. Boa parte
     * desta suíte fala com o Supabase de produção em `sa-east-1`, e um teste
     * de ponta a ponta faz quatro ou cinco idas seguidas até lá — o de encerrar
     * atendimento mediu 3998ms num dia bom. Ele não estava lento: estava a
     * 1 segundo do teto, e qualquer variação da rede o derrubava.
     *
     * Isso vinha sendo lido como "o relógio do WSL2 desandou". Eram duas coisas
     * diferentes com o mesmo sintoma — falha que some ao rodar de novo —, e a
     * segunda escondeu a primeira por semanas. `hookTimeout` sobe junto porque
     * o `beforeAll` destas suítes cria cliente, fluxo, versão e canal.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
