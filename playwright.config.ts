import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { conferirAmbienteLocal } from './test/ambiente-local'

/**
 * A jornada pelo navegador, contra o Postgres local.
 *
 * **Por que este arquivo existe só agora.** O `test:e2e:local` estava no
 * `package.json` desde antes da F5, e a dependência nunca entrou: `npm run
 * test:e2e:local` falhava com "playwright: not found" e quatro `.spec.ts`
 * nomeados por tarefas das fases F7 e F8 ficaram pendentes. A T9.1 pede a
 * jornada integrada por nome, e o A22 (fechar modal alterado sem perder o
 * digitado) é teclado, foco e `Esc` num `<dialog>`: exatamente o que um módulo
 * puro não prova e um navegador prova.
 *
 * **O que ele NÃO faz, de propósito: rodar no CI.** O `.github/workflows/ci.yml`
 * não recebe a chave secreta do Supabase, e a decisão está escrita lá: este
 * repositório é público, e um workflow de um PR de fora leria o segredo. Sem
 * banco, estes testes não teriam o que percorrer. Eles rodam na máquina, antes
 * do push, como os de integração já rodam.
 */

/**
 * O ambiente vem do `.env.teste-local`, e nunca do `.env`.
 *
 * Mesma inversão de `test/ambiente-local.ts`: credencial disponível não é
 * autorização. O `.env` guarda a credencial de produção, e AutoFluxos e Verandi
 * dividem aquele projeto, então um e2e que criasse conta e mandasse mensagem lá
 * mexeria no banco que atende cliente de verdade.
 */
function ambienteDeTeste(): Record<string, string> {
  let cru: string
  try {
    cru = readFileSync(new URL('.env.teste-local', import.meta.url), 'utf8')
  } catch {
    throw new Error(
      'Falta o .env.teste-local. Copie o .env.teste-local.example, suba o ' +
        'Supabase com `npx supabase start` e cole a chave que ele imprime.',
    )
  }

  const env: Record<string, string> = {}
  for (const linha of cru.split('\n')) {
    const corte = linha.indexOf('=')
    if (linha.trimStart().startsWith('#') || corte < 0) continue
    env[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim()
  }

  // O mesmo guarda dos testes de integração, pela mesma razão: host remoto é
  // recusado mesmo com o consentimento preenchido.
  const veredito = conferirAmbienteLocal(env as NodeJS.ProcessEnv)
  if (!veredito.ok) throw new Error(`e2e recusado: ${veredito.motivo}`)

  if (!env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL no .env.teste-local. O login usa Postgres direto ' +
        '(Better Auth com Kysely), e não o PostgREST.',
    )
  }

  return {
    ...env,
    // O painel falha fechado sem estes dois, e o valor aqui é descartável de
    // propósito: nada neste arquivo pode servir para entrar em outro lugar.
    PAINEL_SENHA: env.PAINEL_SENHA ?? 'senha-de-teste-local',
    PAINEL_SEGREDO: env.PAINEL_SEGREDO ?? 'segredo-de-teste-local-sem-valor',
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? 'better-auth-de-teste-local-sem-valor',
    BETTER_AUTH_URL: `http://localhost:${process.env.PORTA ?? '3100'}`,
    NODE_ENV: 'test',
  }
}

// Vários agentes em paralelo: cada um roda o e2e na sua PORTA (padrão 3100).
const PORTA = process.env.PORTA ?? '3100'

export default defineConfig({
  testDir: './test/e2e',

  // Tempo de sobra porque o `next dev` compila a rota na primeira visita: a
  // primeira navegação de cada tela paga a compilação, e o padrão de 30s não
  // cobre isso numa máquina ocupada.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // Serial, e isto é decisão. Os testes dividem um Postgres só e criam conta,
  // contato e cartão com nome fixo: parelelizar transformaria "o outro worker
  // apagou meu fixture" em falha intermitente, que é o pior tipo de falha.
  fullyParallel: false,
  workers: 1,

  // Nenhuma tentativa extra. Teste de navegador que só passa na segunda vez
  // está escondendo uma corrida, e esconder é o oposto do que a F9 quer.
  retries: 0,

  // `forbidOnly` para o `.only` esquecido não passar silenciosamente por verde.
  forbidOnly: true,

  reporter: [['list']],

  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Porta 3100 e não 3000: quem executa costuma ter o `next dev` aberto na
  // 3000, e `reuseExistingServer` naquela porta faria o e2e rodar contra a
  // produção que o `.env` aponta, sem avisar.
  //
  // O host é `localhost` e não `127.0.0.1`, apesar de o guarda aceitar os dois:
  // o `next dev` serve em `localhost`, e pedir pelo IP faz o Next recusar os
  // próprios chunks com "Blocked cross-origin request". A página abre assim
  // mesmo, então isso passaria por verde enquanto enche o log de aviso.
  webServer: {
    command: `npx next dev --port ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: ambienteDeTeste(),
  },
})
