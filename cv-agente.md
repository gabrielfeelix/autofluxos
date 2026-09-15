Plano em docs/PLANO-ENDURECIMENTO.md, comitado (af75839).

Nove blocos, nesta ordem: CI → corrida de sessão → portas abertas (rate limit, teto de corpo, noindex) → escrita cruzada → rollback de versão → observabilidade → sessão do painel → leads com volume + LGPD → mobile e acessibilidade.

O valor está nas decisões, não na lista. As que tomei e escrevi com o porquê:

Trava por tabela, não pg_advisory_lock — o Supabase serve por pooler, e a conexão que pega a trava não é a que solta.
Rate limit no Postgres que já temos, não Upstash — contador em memória não vale nada em serverless, e Upstash é mais um cadastro e mais uma chave no cofre.
Cookie assinado, não sessão em banco — quem confere é o proxy.ts, que roda antes da renderização e não é lugar de ir ao banco a cada requisição.
Webhook de aviso, não Sentry — resolve 90% sem SDK nem cadastro, e o Sentry entra por cima depois se o volume pedir.
Retenção no pg_cron, não cron da Vercel — é um delete, o Postgres faz melhor sozinho.
CI não recebe a chave do Supabase — o repo é público; os testes de banco já se pulam sozinhos e sobram ~150 puros.
Não virou plano de tarefas gigante de propósito. Só o bloco 1 vai detalhado passo a passo, porque é o próximo. Plano escrito com semanas de antecedência apodrece antes de ser executado — detalho cada bloco na hora.

Fora, como pedido: backup PITR (pago). Também de fora, com o motivo escrito: papéis de usuário (plano próprio — os blocos 4 e 7 existem pra ela começar com menos dívida), templates da Meta, CSP com nonce e fila de reentrega.

Se for fazer só três: blocos 1, 2 e 3. O primeiro protege tudo, o segundo é o único defeito que já existe hoje, o terceiro fecha o que dá pra explorar de fora.

Começo pelo bloco 1?

ok começa
Bash Check if next lint exists in Next 16
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
grep -rl "next lint\|eslint" node_modules/next/dist/docs/01-app/03-api-reference/ 2>/dev/null | head -5
echo "--- next lint ainda existe? ---"
grep -rn "next lint" node_modules/next/dist/docs/ 2>/dev/null | head -5

OUT
node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md
node_modules/next/dist/docs/01-app/03-api-reference/06-cli/create-next-app.md
node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md
--- next lint ainda existe? ---
node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md:410:If your project previously used `next lint`, migrate your scripts to the ESLint CLI with the codemod:
node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md:120:  <summary>`next lint` removal</summary>
node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md:122:Starting with Next.js 16, `next lint` is removed.
node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md:385:| `v16.0.0` | `next lint` and the `eslint` next.config.js option were removed in favor of the ESLint CLI. A [codemod](/docs/app/guides/upgrading/codemods#migrate-from-next-lint-to-eslint-cli) is available to help you migrate. |
node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:85:- Migrate from `next lint` to the ESLint CLI
next lint foi removido no Next 16 — meu passo 1.3 estava errado. Lendo o guia certo.

Bash Read Next 16 eslint guide
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -n 1,120p node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md

OUT
---
title: ESLint Plugin
nav_title: ESLint
description: Learn how to use and configure the ESLint plugin to catch common issues and problems in a Next.js application.
---

{/* The content of this doc is shared between the app and pages router. You can use the `<PagesOnly>Content</PagesOnly>` component to add content that is specific to the Pages Router. Any shared content should not be wrapped in a component. */}

Next.js provides an ESLint configuration package, [`eslint-config-next`](https://www.npmjs.com/package/eslint-config-next), that makes it easy to catch common issues in your application. It includes the [`@next/eslint-plugin-next`](https://www.npmjs.com/package/@next/eslint-plugin-next) plugin along with recommended rule-sets from [`eslint-plugin-react`](https://www.npmjs.com/package/eslint-plugin-react) and [`eslint-plugin-react-hooks`](https://www.npmjs.com/package/eslint-plugin-react-hooks).

The package provides two main configurations:

- **`eslint-config-next`**: Base configuration with Next.js, React, and React Hooks rules. Supports both JavaScript and TypeScript files.
- **`eslint-config-next/core-web-vitals`**: Includes everything from the base config, plus upgrades rules that impact [Core Web Vitals](https://web.dev/vitals/) from warnings to errors. Recommended for most projects.

Additionally, for TypeScript projects:

- **`eslint-config-next/typescript`**: Adds TypeScript-specific linting rules from [`typescript-eslint`](https://typescript-eslint.io/). Use this alongside the base or core-web-vitals config.

## Setup ESLint

Get linting working quickly with the ESLint CLI (flat config):

1. Install ESLint and the Next.js config:

   ```bash package="pnpm"
   pnpm add -D eslint eslint-config-next
   ```

   ```bash package="npm"
   npm i -D eslint eslint-config-next
   ```

   ```bash package="yarn"
   yarn add --dev eslint eslint-config-next
   ```

   ```bash package="bun"
   bun add -d eslint eslint-config-next
   ```

2. Create `eslint.config.mjs` with the Next.js config:

   ```js filename="eslint.config.mjs"
   import { defineConfig, globalIgnores } from 'eslint/config'
   import nextVitals from 'eslint-config-next/core-web-vitals'

   const eslintConfig = defineConfig([
     ...nextVitals,
     // Override default ignores of eslint-config-next.
     globalIgnores([
       // Default ignores of eslint-config-next:
       '.next/**',
       'out/**',
       'build/**',
       'next-env.d.ts',
     ]),
   ])

   export default eslintConfig
   ```

3. Run ESLint:

   ```bash package="pnpm"
   pnpm exec eslint .
   ```

   ```bash package="npm"
   npx eslint .
   ```

   ```bash package="yarn"
   yarn eslint .
   ```

   ```bash package="bun"
   bunx eslint .
   ```

## Reference

The `eslint-config-next` package includes the `recommended` rule-sets from the following ESLint plugins:

- [`eslint-plugin-react`](https://www.npmjs.com/package/eslint-plugin-react)
- [`eslint-plugin-react-hooks`](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- [`@next/eslint-plugin-next`](https://www.npmjs.com/package/@next/eslint-plugin-next)

### Rules

The `@next/eslint-plugin-next` rules included are:

| Enabled in recommended config | Rule                                                                                                                     | Description                                                                                                      |
| :---------------------------: | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
|      <Check size={18} />      | [@next/next/google-font-display](/docs/messages/google-font-display)                                                     | Enforce font-display behavior with Google Fonts.                                                                 |
|      <Check size={18} />      | [@next/next/google-font-preconnect](/docs/messages/google-font-preconnect)                                               | Ensure `preconnect` is used with Google Fonts.                                                                   |
|      <Check size={18} />      | [@next/next/inline-script-id](/docs/messages/inline-script-id)                                                           | Enforce `id` attribute on `next/script` components with inline content.                                          |
|      <Check size={18} />      | [@next/next/next-script-for-ga](/docs/messages/next-script-for-ga)                                                       | Prefer `next/script` component when using the inline script for Google Analytics.                                |
|      <Check size={18} />      | [@next/next/no-assign-module-variable](/docs/messages/no-assign-module-variable)                                         | Prevent assignment to the `module` variable.                                                                     |
|      <Check size={18} />      | [@next/next/no-async-client-component](/docs/messages/no-async-client-component)                                         | Prevent Client Components from being async functions.                                                            |
|      <Check size={18} />      | [@next/next/no-before-interactive-script-outside-document](/docs/messages/no-before-interactive-script-outside-document) | Prevent usage of `next/script`'s `beforeInteractive` strategy outside of `pages/_document.js`.                   |
|      <Check size={18} />      | [@next/next/no-css-tags](/docs/messages/no-css-tags)                                                                     | Prevent manual stylesheet tags.                                                                                  |
|      <Check size={18} />      | [@next/next/no-document-import-in-page](/docs/messages/no-document-import-in-page)                                       | Prevent importing `next/document` outside of `pages/_document.js`.                                               |
|      <Check size={18} />      | [@next/next/no-duplicate-head](/docs/messages/no-duplicate-head)                                                         | Prevent duplicate usage of `<Head>` in `pages/_document.js`.                                                     |
|      <Check size={18} />      | [@next/next/no-head-element](/docs/messages/no-head-element)                                                             | Prevent usage of `<head>` element.                                                                               |
|      <Check size={18} />      | [@next/next/no-head-import-in-document](/docs/messages/no-head-import-in-document)                                       | Prevent usage of `next/head` in `pages/_document.js`.                                                            |
|      <Check size={18} />      | [@next/next/no-html-link-for-pages](/docs/messages/no-html-link-for-pages)                                               | Prevent usage of `<a>` elements to navigate to internal Next.js pages.                                           |
|      <Check size={18} />      | [@next/next/no-img-element](/docs/messages/no-img-element)                                                               | Prevent usage of `<img>` element due to slower LCP and higher bandwidth.                                         |
|      <Check size={18} />      | [@next/next/no-page-custom-font](/docs/messages/no-page-custom-font)                                                     | Prevent page-only custom fonts.                                                                                  |
|      <Check size={18} />      | [@next/next/no-script-component-in-head](/docs/messages/no-script-component-in-head)                                     | Prevent usage of `next/script` in `next/head` component.                                                         |
|      <Check size={18} />      | [@next/next/no-styled-jsx-in-document](/docs/messages/no-styled-jsx-in-document)                                         | Prevent usage of `styled-jsx` in `pages/_document.js`.                                                           |
|      <Check size={18} />      | [@next/next/no-sync-scripts](/docs/messages/no-sync-scripts)                                                             | Prevent synchronous scripts.                                                                                     |
|      <Check size={18} />      | [@next/next/no-title-in-document-head](/docs/messages/no-title-in-document-head)                                         | Prevent usage of `<title>` with `Head` component from `next/document`.                                           |
|      <Check size={18} />      | @next/next/no-typos                                                                                                      | Prevent common typos in [Next.js's data fetching functions](/docs/pages/building-your-application/data-fetching) |
|      <Check size={18} />      | [@next/next/no-unwanted-polyfillio](/docs/messages/no-unwanted-polyfillio)                                               | Prevent duplicate polyfills from Polyfill.io.                                                                    |

We recommend using an appropriate [integration](https://eslint.org/docs/user-guide/integrations#editors) to view warnings and errors directly in your code editor during development.

<details>
  <summary>`next lint` removal</summary>
Bash Install eslint
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm i -D eslint eslint-config-next 2>&1 | tail -4
echo "--- versões ---"; node -p "const p=require('./package.json'); JSON.stringify({eslint:p.devDependencies.eslint, next:p.devDependencies['eslint-config-next']})"

OUT
npm warn allow-scripts   esbuild@0.28.2 (install: (install scripts present))
npm warn allow-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
--- versões ---
{"eslint":"^9.39.5","next":"^16.3.0"}
Write eslint.config.mjs
35 lines
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * O lint pega o que a revisão humana não pega.
 *
 * O projeto sempre supôs ESLint e nunca o teve: já havia
 * `// eslint-disable-next-line no-control-regex` em `interpolar.ts` e um
 * `react-hooks/exhaustive-deps` desligado em `conversa.tsx`, os dois
 * apontando para regras que nunca rodaram. Agora rodam.
 *
 * Nada de regra de estilo. O formato do código aqui é consistente porque foi
 * escrito com cuidado, e brigar com isso via lint só produz ruído que ensina
 * todo mundo a ignorar o lint.
 *
 * `next lint` não existe mais — foi removido no Next 16 em favor do CLI do
 * ESLint. É por isso que o script em `package.json` chama `eslint` direto.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  globalIgnores([
    // Os padrões do eslint-config-next, que precisam ser repetidos quando a
    // gente declara os nossos.
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Nosso: artefato de build do tsc.
    'tsconfig.tsbuildinfo',
  ]),
])
Bash Run eslint
IN
npx eslint . 2>&1 | tail -50

OUT
/home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos/postcss.config.mjs
  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export

/home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos/src/core/engine/interpolar.ts
  54:1  warning  Unused eslint-disable directive (no problems were reported from 'no-control-regex')

✖ 2 problems (0 errors, 2 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
Só 2 avisos. Mas reparei numa coisa: o eslint-config-next não traz as regras base do próprio ESLint — o no-control-regex do interpolar.ts nunca rodou. Vou ver se dá pra ligar.

Bash Test with js recommended rules
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
cp eslint.config.mjs /tmp/claude-1000/-home-gabrielbarbosa-dev-gabriel-4yu-apps-autofluxos/b5a98362-0c59-4bc7-b80e-727db04939cc/scratchpad/eslint.bak
python3 - <<'PY'
import pathlib
p = pathlib.Path("eslint.config.mjs"); t = p.read_text()
t = t.replace("import { defineConfig, globalIgnores } from 'eslint/config'",
              "import js from '@eslint/js'\nimport { defineConfig, globalIgnores } from 'eslint/config'")
t = t.replace("export default defineConfig([\n  ...nextVitals,",
              "export default defineConfig([\n  js.configs.recommended,\n  ...nextVitals,")
p.write_text(t)
PY
npx eslint . 2>&1 | tail -40

OUT
/home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos/postcss.config.mjs
  1:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export

✖ 1 problem (0 errors, 1 warning)
Melhor ainda: com as regras base ligadas, o no-control-regex do interpolar.ts passa a valer de verdade e o aviso some. Sobrou um. Limpo ele.

Bash Check postcss config and eslint/js dep
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
cat postcss.config.mjs
echo "--- @eslint/js está declarado? ---"
node -p "require('./package.json').devDependencies['@eslint/js'] ?? 'NÃO — só transitivo'"

OUT
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
--- @eslint/js está declarado? ---
NÃO — só transitivo
Write postcss.config.mjs
9 lines
/** O Tailwind entra pelo PostCSS. É só isto que este arquivo faz. */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
Bash Add lint script and verify clean
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm i -D @eslint/js 2>&1 | tail -2
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("package.json"); d = json.loads(p.read_text())
d["scripts"]["lint"] = "eslint ."
# ordem estável: lint logo depois de typecheck
ordem = ["dev","build","start","test","test:watch","typecheck","lint"]
d["scripts"] = {k: d["scripts"][k] for k in ordem if k in d["scripts"]} | {k:v for k,v in d["scripts"].items() if k not in ordem}
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(d["scripts"], indent=2))
PY
echo "--- lint ---"; npm run lint 2>&1 | tail -8

OUT
npm error /home/gabrielbarbosa/.npm/_logs/2026-08-12T17_28_33_985Z-eresolve-report.txt
npm error A complete log of this run can be found in: /home/gabrielbarbosa/.npm/_logs/2026-08-12T17_28_33_985Z-debug-0.log
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "lint": "eslint ."
}
--- lint ---

> autofluxos@0.0.1 lint
> eslint .
Bash Inspect eresolve error
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm i -D @eslint/js 2>&1 | grep -E "eresolve|Found:|Could not resolve|peer|While resolving|conflicting" | head -12

OUT
npm error While resolving: @eslint/js@10.0.1
npm error Found: eslint@9.39.5
npm error   peer eslint@"^6.0.0 || ^7.0.0 || >=8.0.0" from @eslint-community/eslint-utils@4.10.1
npm error   peer eslint@"^6.0.0 || ^7.0.0 || >=8.0.0" from @eslint-community/eslint-utils@4.9.1
npm error Could not resolve dependency:
npm error peerOptional eslint@"^10.0.0" from @eslint/js@10.0.1
npm error Conflicting peer dependency: eslint@10.8.1
npm error   peerOptional eslint@"^10.0.0" from @eslint/js@10.0.1
npm error Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps to accept an incorrect (and potentially broken) dependency resolution.
npm error /home/gabrielbarbosa/.npm/_logs/2026-08-12T17_28_55_541Z-eresolve-report.txt
@eslint/js mais recente quer ESLint 10; temos o 9. Fixo a versão certa.

Bash Install matching eslint/js and verify
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm i -D "@eslint/js@^9" 2>&1 | tail -3
node -p "'@eslint/js -> ' + require('./package.json').devDependencies['@eslint/js']"
echo "--- lint ---"; npm run lint 2>&1 | tail -6
echo "--- typecheck ---"; npm run typecheck 2>&1 | tail -3

OUT
npm warn allow-scripts   unrs-resolver@1.12.2 (install: (install scripts present))
npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
@eslint/js -> ^9.39.5
--- lint ---

> autofluxos@0.0.1 lint
> eslint .

--- typecheck ---
> autofluxos@0.0.1 typecheck
> tsc --noEmit
Lint limpo, zero avisos. Agora o workflow.

Write ci.yml
49 lines
name: CI

on:
  push:
    branches: [main]
  pull_request:

# Um push em cima do outro cancela o anterior: o que interessa é o estado do
# topo do branch, não a fila de commits do meio do caminho.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  conferir:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - name: Tipos
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      # Sem SUPABASE_URL no ambiente, os arquivos de teste que falam com o
      # banco se pulam sozinhos (`describe.skipIf`) e sobram os puros — motor,
      # validador, interpolação, recusa de endereço, janela de 24h, prompt da
      # IA e autenticação do painel.
      #
      # A chave secreta do Supabase NÃO entra como secret do GitHub, e isso é
      # decisão, não esquecimento: este repositório é público, e um workflow
      # de um PR de fora leria o segredo. O que fala com banco roda na máquina
      # antes do push.
      - name: Testes
        run: npm test

      - name: Build
        run: npm run build
Bash Simulate CI test run without DB credentials
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
echo "=== simulando o CI: testes SEM credencial de banco ==="
env -u SUPABASE_URL -u SUPABASE_SECRET_KEY -u GEMINI_API_KEY npx vitest run 2>&1 | tail -20

OUT
=== simulando o CI: testes SEM credencial de banco ===

 FAIL  src/server/receber-mensagem.test.ts [ src/server/receber-mensagem.test.ts ]
Error: não deu para criar o cliente: JWT issued at future
 ❯ criarCliente src/server/repos/clientes.ts:61:20
     59|     .single()
     60| 
     61|   if (error) throw new Error(`não deu para criar o cliente: ${error.me…
       |                    ^
     62|   return paraCliente(data as Linha)
     63| }
 ❯ src/server/receber-mensagem.test.ts:98:19

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 11 passed | 2 skipped (14)
      Tests  209 passed | 22 skipped (231)
   Start at  14:31:33
   Duration  13.18s (transform 3.43s, setup 0ms, collect 13.82s, tests 21.73s, environment 3ms, prepare 2.06s)
O -u não bastou — o vitest carrega o .env sozinho. Preciso simular sem o arquivo pra provar que o CI vai passar.

Bash Read vitest config
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
cat vitest.config.ts

OUT
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
  },
})
Bash Simulate CI without .env file
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
mv .env .env.guardado
echo "=== testes exatamente como o CI vai rodar (sem .env) ==="
npx vitest run 2>&1 | tail -14
mv .env.guardado .env
echo "--- .env de volta: $(test -f .env && echo sim) ---"

OUT
=== testes exatamente como o CI vai rodar (sem .env) ===
 ✓ src/server/ia/prompt.test.ts (9 tests) 13ms
 ✓ src/app/api/simular/route.test.ts (5 tests) 33ms
 ✓ src/channels/janela.test.ts (6 tests) 10ms
 ✓ src/server/efeitos/http.test.ts (40 tests) 38ms
 ✓ src/server/efeitos/rede.test.ts (30 tests) 17ms
 ✓ src/server/efeitos/resolver.test.ts (17 tests) 29ms
 ↓ src/server/ia/gemini.test.ts (6 tests | 6 skipped)
 ↓ src/server/efeitos/ponta-a-ponta.test.ts (2 tests | 2 skipped)

 Test Files  9 passed | 5 skipped (14)
      Tests  189 passed | 42 skipped (231)
   Start at  14:32:00
   Duration  1.50s (transform 1.07s, setup 0ms, collect 3.12s, tests 242ms, environment 4ms, prepare 1.58s)

--- .env de volta: sim ---
189 testes passam sem .env, em 1,5s. Exatamente como projetado. Build e commit.

Bash Build and full test suite
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm run build 2>&1 | grep -E "Compiled|error|Proxy" | head
echo "=== suíte completa, com banco ==="; npm test 2>&1 | tail -4

OUT
✓ Compiled successfully in 4.4s
ƒ Proxy (Middleware)
=== suíte completa, com banco ===
      Tests  223 passed | 8 skipped (231)
   Start at  14:32:29
   Duration  18.79s (transform 1.35s, setup 0ms, collect 3.72s, tests 35.70s, environment 4ms, prepare 1.99s)
Edit PLANO-ENDURECIMENTO.md
Added 16 lines
Bash Commit and push CI
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
python3 - <<'PY'
import pathlib
p = pathlib.Path("docs/PLANO-ENDURECIMENTO.md"); t = p.read_text()
t = t.replace("""- [ ] **1.3 — Adicionar o script**

Em `package.json`, dentro de `scripts`:

```json
"lint": "next lint"
```""", """- [ ] **1.3 — Adicionar o script**

Em `package.json`, dentro de `scripts`:

```json
"lint": "eslint ."
```

(`next lint` foi removido no Next 16.)""")
t = t.replace("""1. CI                     protege todos os outros""", """1. CI  ✅              protege todos os outros""")
p.write_text(t); print("ok")
PY
git add -A && git commit -q -F - <<'EOF' && git push -q origin main
ci: typecheck, lint, testes e build a cada push

Nada rodava antes de subir. Agora roda, e é o item mais barato da lista
inteira de endurecimento.

O ESLint entrou junto porque o projeto sempre supôs que ele existia: já
havia um `eslint-disable-next-line no-control-regex` em `interpolar.ts`
apontando para uma regra que nunca rodou. Duas coisas que a execução
mostrou e o plano não previa — `next lint` foi removido no Next 16, e
`eslint-config-next` não traz as regras base do próprio ESLint. Com
`js.configs.recommended` ligado, aquele disable passa a valer de verdade
e a base ficou limpa na primeira passada; o único aviso era o export
anônimo do postcss, corrigido aqui.

O CI não recebe a chave do Supabase, e isso é decisão. Este repositório
é público, e workflow de um PR de fora leria o segredo. Os arquivos de
teste que falam com banco já se pulam sozinhos sem `.env` — sobram 189
testes puros, em um segundo e meio. O que precisa de banco roda na
máquina antes do push.

Conferido rodando sem o `.env` no lugar, que é exatamente o que o CI vê.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
git log --oneline -1

OUT
ok
8b955e1 ci: typecheck, lint, testes e build a cada push
Bash Watch CI run
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
gh run list --limit 3 2>&1 | head -5
echo "--- acompanhando ---"
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status 2>&1 | tail -20

OUT
queued		ci: typecheck, lint, testes e build a cada push	CI	main	push	31623329800	3s	2026-08-12T17:34:47Z
--- acompanhando ---
Triggered via push about 1 minute ago

JOBS
✓ conferir in 52s (ID 94203337254)
  ✓ Set up job
  ✓ Run actions/checkout@v4
  ✓ Run actions/setup-node@v4
  ✓ Run npm ci
  ✓ Tipos
  ✓ Lint
  ✓ Testes
  ✓ Build
  ✓ Post Run actions/setup-node@v4
  ✓ Post Run actions/checkout@v4
  ✓ Complete job

ANNOTATIONS
! Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
conferir: .github#2
Verde em 52s. Mas veio um aviso de depreciação — e CI que nasce com aviso ensina a ignorar aviso. Subo as actions.

Bash Bump actions and re-run CI
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -i 's|actions/checkout@v4|actions/checkout@v5|; s|actions/setup-node@v4|actions/setup-node@v5|' .github/workflows/ci.yml
grep -n "uses:" .github/workflows/ci.yml
git add -A && git commit -q -m "$(cat <<'EOF'
ci: sobe checkout e setup-node para v5

As v4 rodam em Node 20, que o GitHub depreciou, e o job vinha com
anotação amarela. CI que nasce com aviso ensina todo mundo a ignorar
aviso — o mesmo motivo de o lint ter entrado limpo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)" && git push -q origin main
gh run watch $(sleep 6; gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status 2>&1 | tail -16

OUT
20:      - uses: actions/checkout@v5
22:      - uses: actions/setup-node@v5
✓ main CI · 31623454908
Triggered via push less than a minute ago

JOBS
✓ conferir in 43s (ID 94203757255)
  ✓ Set up job
  ✓ Run actions/checkout@v5
  ✓ Run actions/setup-node@v5
  ✓ Run npm ci
  ✓ Tipos
  ✓ Lint
  ✓ Testes
  ✓ Build
  ✓ Post Run actions/setup-node@v5
  ✓ Post Run actions/checkout@v5
  ✓ Complete job
Bloco 1 fechado. CI verde em 43s, sem avisos — gh run watch confirmou os cinco passos: tipos, lint, testes, build.

Duas coisas que o plano errou e a execução corrigiu:

next lint não existe mais — removido no Next 16 em favor do CLI do ESLint, com flat config. (O AGENTS.md avisa exatamente sobre isso: esse Next não é o que eu conheço de treino. Li a doc antes de escrever.)
eslint-config-next não traz as regras base do próprio ESLint. Sem js.configs.recommended, aquele // eslint-disable-next-line no-control-regex que já estava em interpolar.ts:54 era comentário morto — a regra nunca rodou. Liguei, e agora ele vale de verdade. A base passou limpa de primeira; o único aviso era o export anônimo do postcss.config.mjs, corrigido.
Registrei as duas correções dentro do próprio plano, porque são a prova do argumento de detalhar cada bloco só na hora de executá-lo.

O CI não recebe a chave do Supabase, e isso está escrito no workflow: o repo é público, e um PR de fora leria o segredo. Sem .env os testes de banco se pulam sozinhos — sobram 189 puros em 1,5s. Conferi rodando com o .env fora do lugar, que é literalmente o que o runner vê. O que precisa de banco continua rodando na sua máquina antes do push (223 no total).

Próximo é o bloco 2, corrida de sessão — o único defeito da lista que já existe hoje, não é risco futuro. Sigo?

faça
Bloco 2. Primeiro olho o padrão das migrations e da view de leads pra não destoar.

Bash Read migration patterns
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
echo "=== 0002 (padrão de function) ==="; cat supabase/migrations/0002_versoes.sql
echo "=== 0004 (view leads) ==="; cat supabase/migrations/0004_leads.sql

OUT
=== 0002 (padrão de function) ===
-- 0002 — versões publicadas.
--
-- O rascunho (`flows.rascunho`) é mutável e é o que o editor salva. Publicar
-- tira uma foto dele e guarda numa linha que nunca mais muda.
--
-- Sem isso: você edita o fluxo às 15h e a conversa que começou às 14h se vê num
-- nó que não existe mais. Quebra silenciosa, difícil de reproduzir, e quem
-- descobre é o cliente. Com isso: quem já estava conversando termina na versão
-- antiga; quem chegar depois pega a nova (o vínculo da sessão entra no passo 6,
-- junto com a tabela `sessions`).

create table if not exists public.flow_versions (
  id           uuid primary key default gen_random_uuid(),
  flow_id      uuid not null references public.flows (id) on delete cascade,
  versao       integer not null,
  grafo        jsonb not null,
  publicado_em timestamptz not null default now(),
  unique (flow_id, versao)
);

create index if not exists flow_versions_flow_id_idx on public.flow_versions (flow_id);

alter table public.flows
  add column if not exists versao_publicada_id uuid
  references public.flow_versions (id) on delete set null;

-- "Imutável" como regra do banco, não como intenção de quem escreve o código.
-- Um `update` distraído aqui reescreveria a versão debaixo de conversas que
-- estão acontecendo — exatamente o problema que a tabela existe para evitar.
create or replace function public.versao_e_imutavel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'versão publicada não pode ser alterada (flow_id=%, versao=%)',
    old.flow_id, old.versao;
end;
$$;

drop trigger if exists flow_versions_imutavel on public.flow_versions;
create trigger flow_versions_imutavel
  before update on public.flow_versions
  for each row execute function public.versao_e_imutavel();

-- Publicar em uma transação só.
--
-- Numerar com `max(versao)+1` do lado da aplicação abriria corrida entre duas
-- publicações simultâneas. Aqui a numeração e o apontamento acontecem juntos, e
-- a constraint `unique (flow_id, versao)` é a rede embaixo.
create or replace function public.publicar_fluxo(p_flow_id uuid, p_grafo jsonb)
returns public.flow_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nova public.flow_versions;
begin
  insert into public.flow_versions (flow_id, versao, grafo)
  values (
    p_flow_id,
    coalesce((select max(v.versao) from public.flow_versions v where v.flow_id = p_flow_id), 0) + 1,
    p_grafo
  )
  returning * into nova;

  update public.flows set versao_publicada_id = nova.id where id = p_flow_id;

  return nova;
end;
$$;

-- Publicar é ação de servidor, com a chave secreta. Ninguém publica do navegador.
revoke execute on function public.publicar_fluxo(uuid, jsonb) from anon, authenticated;

alter table public.flow_versions enable row level security;
=== 0004 (view leads) ===
-- 0004 — a visão de leads.
--
-- A tela de leads faz três perguntas por contato: o que o fluxo coletou, se
-- tem alguém esperando atendimento humano, e quando foi a última mensagem.
-- As duas últimas são agregações — "a última linha de `messages`", "o handoff
-- aberto mais recente" — e agregação não existe no PostgREST.
--
-- Dava para fazer no TypeScript: puxar os contatos, puxar TODAS as mensagens
-- deles e reduzir na memória. Funciona com dez leads e cai sozinho com dez
-- mil. Pior: ordenar por "última mensagem" exigiria ter todas em mãos antes de
-- desenhar a primeira linha da tabela. O banco resolve isso com o índice que
-- já existe (`messages_contact_idx`), lendo uma linha por contato.
--
-- `security_invoker = true` não é detalhe. Sem ele a view roda com os direitos
-- de quem a criou e passa por cima da RLS das tabelas de baixo — a chave
-- `publishable`, que vai para o navegador, leria a conversa de todo mundo. Uma
-- view é o jeito clássico de furar RLS sem perceber. Com ele, a view obedece a
-- mesma RLS de sempre: ligada, sem política, ninguém entra. O `revoke` embaixo
-- é a segunda tranca.

-- O handoff aberto é a busca da tela; o índice parcial só indexa o que ela lê.
create index if not exists handoffs_abertos_idx
  on public.handoffs (session_id, criado_em desc)
  where resolvido_em is null;

create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em
from public.contacts c
-- `lateral ... limit 1` em vez de `group by`: é o que deixa o Postgres parar na
-- primeira linha do índice em vez de varrer a conversa inteira para descartar.
left join lateral (
  select m.ts, m.direcao, m.texto
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true;

-- Leads são dados de cliente. Só o servidor, com a chave secreta.
revoke all on public.leads from anon, authenticated;

-- O PostgREST guarda o desenho do schema em cache; sem isto a view só aparece
-- no próximo restart do projeto.
notify pgrst, 'reload schema';
Padrão entendido. Começo pelo teste que falha — duas mensagens em paralelo do mesmo contato.

Edit receber-mensagem.test.ts
Added 30 lines
Bash Confirm the race test fails
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npx vitest run src/server/receber-mensagem.test.ts -t "duas mensagens ao mesmo tempo" 2>&1 | tail -22

OUT
- Expected
+ Received

- 1
+ 2

 ❯ src/server/receber-mensagem.test.ts:353:21
    351|       .eq('contact_id', contato!.id as string)
    352| 
    353|     expect(sessoes).toHaveLength(1)
       |                     ^
    354|   })
    355| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 14 skipped (15)
   Start at  14:56:41
   Duration  3.90s (transform 276ms, setup 0ms, collect 508ms, tests 2.84s, environment 0ms, prepare 94ms)
Reproduzido: duas sessões. O bug é real. Agora a trava.

Write 0007_travas.sql
73 lines
-- 0007 — uma conversa por vez, por contato.
--
-- O problema: quem manda "oi" e "tudo bem?" em seguida gera dois webhooks, e
-- nada garante que o segundo espere o primeiro. Os dois leem a sessão no mesmo
-- estado; como o primeiro ainda não gravou nada, o segundo também conclui que
-- a conversa é nova e cria uma **segunda sessão**. A conversa reinicia sozinha
-- e a pessoa vê a saudação duas vezes. Reproduzido em teste antes de existir
-- esta migration.
--
-- Por que uma tabela e não `pg_advisory_lock`: o advisory lock de sessão vive
-- preso à conexão, e o Supabase serve por *pooler* — a conexão que pega a
-- trava não é necessariamente a que a solta, e uma que morre segurando trava
-- deixa o contato mudo até o pooler reciclar. Tabela com prazo é mais chata de
-- ler e não tem esse buraco.
--
-- Por que não `unique (contact_id, channel_id)` em `sessions`: porque sessão
-- encerrada e sessão nova do mesmo contato coexistem de propósito — é assim que
-- o histórico sobrevive ao "Já atendi". A trava resolve a corrida sem proibir
-- o que é legítimo.

create table if not exists public.conversation_locks (
  contact_id uuid primary key references public.contacts (id) on delete cascade,
  -- Quando esta trava deixa de valer. Não é "quando foi pega": prazo é o que
  -- garante que uma função morta no meio não trave o contato para sempre.
  ate        timestamptz not null
);

-- Pega a trava, ou diz que não deu.
--
-- Um `insert ... on conflict do update ... where` é **uma** instrução, e por
-- isso é atômico sem transação explícita: ou a linha é criada, ou ela é
-- tomada de uma trava vencida, ou nada acontece porque alguém a segura. O
-- `where` é o que separa os dois últimos casos, e o `returning` só devolve
-- linha quando houve escrita — daí o `coalesce(..., false)`.
create or replace function public.travar_contato(alvo uuid, segundos integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pegou boolean;
begin
  insert into public.conversation_locks (contact_id, ate)
  values (alvo, now() + make_interval(secs => segundos))
  on conflict (contact_id) do update
    set ate = excluded.ate
    where public.conversation_locks.ate < now()
  returning true into pegou;

  return coalesce(pegou, false);
end;
$$;

-- Soltar é apagar. A linha só existe enquanto alguém segura.
create or replace function public.destravar_contato(alvo uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.conversation_locks where contact_id = alvo;
$$;

-- Travar é ação de servidor, com a chave secreta — como tudo aqui.
revoke execute on function public.travar_contato(uuid, integer) from anon, authenticated;
revoke execute on function public.destravar_contato(uuid) from anon, authenticated;

-- Mesma postura das outras: ligada, sem política. Só o servidor entra.
alter table public.conversation_locks enable row level security;

notify pgrst, 'reload schema';
Bash Find how migrations are applied
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
grep -rn "supabase\|migration" README.md docs/ARQUITETURA.md 2>/dev/null | grep -i "aplicar\|rodar\|migration" | head -6

OUT
README.md:44:Migrations em [supabase/migrations/](supabase/migrations/), aplicadas pela
docs/ARQUITETURA.md:309:├── supabase/migrations/
docs/ARQUITETURA.md:675:`flows.ia_habilitada` (migration 0005). O mesmo negócio pode ter uma triagem
Bash Read migration instructions
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -n 40,50p README.md

OUT
normal — dá para clonar e rodar `npm test` sem credencial nenhuma.

## Banco

Migrations em [supabase/migrations/](supabase/migrations/), aplicadas pela
Management API do Supabase.

`clients`, `flows` e `flow_versions` (passos 3 e 5); `channels`, `contacts`,
`sessions`, `messages` e `handoffs` (passo 6, criadas só quando já se sabia o
formato real do que o WhatsApp manda — tabela criada "por garantia" e nunca
usada só acumula divergência entre o desenho e o código).
Aplico pela Management API, como as anteriores.

Bash Apply migration 0007
IN
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
REF=xxxynoshwirupkdzwxbj
resposta=$(python3 -c "
import json,os,sys,urllib.request
sql = open('supabase/migrations/0007_travas.sql').read()
req = urllib.request.Request(
  f'https://api.supabase.com/v1/projects/$REF/database/query',
  data=json.dumps({'query': sql}).encode(),
  headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},
  method='POST')
try:
  print(urllib.request.urlopen(req).read().decode()[:400])
except urllib.error.HTTPError as e:
  print('ERRO', e.code, e.read().decode()[:400])
")
echo "$resposta"

OUT
ERRO 403 error code: 1010
Bash Apply migration via curl and verify
IN
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
REF=xxxynoshwirupkdzwxbj
python3 -c "
import json
print(json.dumps({'query': open('supabase/migrations/0007_travas.sql').read()}))" > /tmp/claude-1000/-home-gabrielbarbosa-dev-gabriel-4yu-apps-autofluxos/b5a98362-0c59-4bc7-b80e-727db04939cc/scratchpad/mig.json
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data @/tmp/claude-1000/-home-gabrielbarbosa-dev-gabriel-4yu-apps-autofluxos/b5a98362-0c59-4bc7-b80e-727db04939cc/scratchpad/mig.json | head -c 400
echo; echo "--- conferindo que a tabela e as funções existem ---"
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select proname from pg_proc where proname in ('"'"'travar_contato'"'"','"'"'destravar_contato'"'"') union all select '"'"'tabela:'"'"'||tablename from pg_tables where tablename='"'"'conversation_locks'"'"';"}'

OUT
[]
--- conferindo que a tabela e as funções existem ---
[{"proname":"destravar_contato"},{"proname":"travar_contato"},{"proname":"tabela:conversation_locks"}]
Migration aplicada e conferida. Agora o repo da trava.

Write travas.ts
86 lines
import 'server-only'
import { db } from '../db'

/**
 * Uma conversa por vez, por contato.
 *
 * Existe por um defeito reproduzido em teste: duas mensagens da mesma pessoa
 * chegando quase juntas viram dois `after()` concorrentes, os dois leem a
 * sessão no mesmo estado, e como o primeiro ainda não gravou, o segundo
 * também conclui que a conversa é nova — nascem **duas sessões** e a pessoa vê
 * a saudação duas vezes.
 *
 * O desenho está em `supabase/migrations/0007_travas.sql`; aqui mora só a
 * política de espera.
 */

/**
 * Quanto tempo a trava vale.
 *
 * Tem que caber o pior caso do processamento — que é o `maxDuration` de 60s do
 * webhook, gasto por um fluxo com nó de API lento. Um pouco mais, para a trava
 * não vencer com o trabalho ainda em pé; nunca muito mais, porque este é o
 * tempo que um contato fica mudo se a função morrer segurando a trava.
 */
const VALIDADE_SEGUNDOS = 75

/** Quanto tempo alguém espera pela vez antes de desistir. */
const ESPERA_MAXIMA_MS = 20_000

/** Entre uma tentativa e outra. Sobe até um teto — ver `esperar`. */
const PAUSA_INICIAL_MS = 120
const PAUSA_MAXIMA_MS = 1_500

export type Destravar = () => Promise<void>

/**
 * Espera a vez e devolve como soltar. `null` = não conseguiu a tempo.
 *
 * **Espera em vez de desistir de cara**, e isso é decisão: quando chega aqui, a
 * mensagem já foi gravada e deduplicada em `registrarEntrada`, então desistir
 * significa a pessoa nunca receber resposta e a Meta nunca reenviar. Vinte
 * segundos cabem no orçamento de 60s do webhook e cobrem qualquer conversa
 * normal — o que não couber é sinal de coisa travada, não de fila.
 *
 * Quem chama **precisa** soltar num `finally`. Não soltar não é catastrófico
 * (a trava vence sozinha), mas deixa o contato mudo pelo resto da validade.
 */
export async function travarContato(contatoId: string): Promise<Destravar | null> {
  const limite = Date.now() + ESPERA_MAXIMA_MS
  let pausa = PAUSA_INICIAL_MS

  for (;;) {
    const { data, error } = await db().rpc('travar_contato', {
      alvo: contatoId,
      segundos: VALIDADE_SEGUNDOS,
    })

    // Banco fora do ar não pode virar exceção aqui: isto roda dentro do
    // `after()` do webhook, e exceção lá deixa a pessoa sem resposta nenhuma.
    // Sem trava, quem chamou decide — e hoje decide passar para uma pessoa.
    if (error) return null

    if (data === true) {
      return async () => {
        try {
          await db().rpc('destravar_contato', { alvo: contatoId })
        } catch {
          // A trava vence sozinha. Estourar aqui trocaria um contato mudo por
          // 75 segundos por uma exceção sem dono no caminho do webhook.
        }
      }
    }

    if (Date.now() + pausa >= limite) return null

    await esperar(pausa)
    // Recuo: duas mensagens seguidas se resolvem no primeiro fôlego; uma fila
    // maior não fica martelando o banco enquanto espera.
    pausa = Math.min(pausa * 2, PAUSA_MAXIMA_MS)
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}
Agora ligo no caminho do webhook.

Edit receber-mensagem.ts
Added 42 lines
Bash Read rest of the moved function
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -n 148,205p src/server/receber-mensagem.ts

OUT
 * Não conseguiu a vez dentro do prazo.
 *
 * Vinte segundos esperando significa que alguma coisa está presa, não que há
 * fila. A mensagem já foi deduplicada, então a pessoa não pode simplesmente
 * ficar sem resposta e sem aparecer em lugar nenhum: vira handoff, que é o que
 * a tela de leads mostra. Sem sessão para pendurar o handoff, resta o log.
 */
async function desistirDaVez(canalSalvo: CanalSalvo, contato: Contato): Promise<void> {
  console.error('[whatsapp] não consegui a vez do contato', contato.id)

  const salva = await ultimaSessao(contato.id, canalSalvo.id)
  if (!salva) return

  await registrarHandoff(salva.id, 'a conversa ficou presa e a mensagem não foi processada')
  await definirStatusDaSessao(salva.id, 'humano')
}

async function avancarConversa(
  canalSalvo: CanalSalvo,
  contato: Contato,
  mensagem: Mensagem,
  entrada: Entrada,
  texto: string | null,
  fabricaDeCanal: FabricaDeCanal,
): Promise<void> {
  let salva = await ultimaSessao(contato.id, canalSalvo.id)

  // O humano assumiu. O bot fica calado — a mensagem fica registrada, e quem
  // responde é a pessoa, do celular dela.
  if (salva && salva.sessao.status === 'humano') {
    await vincularSessaoNaMensagem(mensagem.id, salva.id)
    return
  }

  const conversaNova = !salva || salva.sessao.status === 'encerrada'
  let grafoId: string

  if (conversaNova) {
    if (!canalSalvo.flowId) return

    const fluxo = await acharFluxo(canalSalvo.flowId)
    // Nada publicado: o bot não fala. Melhor silêncio do que responder com um
    // rascunho que ninguém revisou.
    if (!fluxo?.versaoPublicadaId) return

    grafoId = fluxo.versaoPublicadaId
    salva = await criarSessao(contato.id, canalSalvo.id, grafoId, sessaoNova())
  } else {
    grafoId = salva!.flowVersionId
  }

  const versao = await acharVersao(grafoId)
  if (!versao || !salva) return

  await vincularSessaoNaMensagem(mensagem.id, salva.id)

  // Conversa nova começa pelo início do fluxo. A primeira mensagem da pessoa
  // é o gatilho, não uma resposta — ela ainda não foi perguntada nada.
Bash Add imports and typecheck
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
python3 - <<'PY'
import pathlib
p = pathlib.Path("src/server/receber-mensagem.ts"); t = p.read_text()
t = t.replace("""import {
  acharCanalPorNumero,
  acharOuCriarContato,
  criarSessao,
  guardarCampo,
  guardarSessao,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
  ultimaSessao,
  vincularSessaoNaMensagem,
  type CanalSalvo,
  type Contato,
} from './repos/conversas'""",
"""import {
  acharCanalPorNumero,
  acharOuCriarContato,
  criarSessao,
  definirStatusDaSessao,
  guardarCampo,
  guardarSessao,
  registrarEntrada,
  registrarHandoff,
  registrarSaida,
  ultimaSessao,
  vincularSessaoNaMensagem,
  type CanalSalvo,
  type Contato,
} from './repos/conversas'
import { travarContato } from './repos/travas'""")
p.write_text(t); print("ok")
PY
npm run typecheck 2>&1 | tail -8

OUT
ok

> autofluxos@0.0.1 typecheck
> tsc --noEmit
Bash Run webhook tests with lock
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npx vitest run src/server/receber-mensagem.test.ts 2>&1 | tail -22

OUT
[whatsapp] não deu para entregar a mensagem Cloud API respondeu 400: canal caiu

 ✓ src/server/receber-mensagem.test.ts (15 tests) 17554ms
   ✓ receber mensagem do WhatsApp > primeira mensagem começa o fluxo e responde com a saudação e as opções  806ms
   ✓ receber mensagem do WhatsApp > ignora reenvio da mesma mensagem — senão a conversa anda duas vezes  880ms
   ✓ receber mensagem do WhatsApp > clicar num botão avança o fluxo e guarda a resposta no contato  1329ms
   ✓ receber mensagem do WhatsApp > áudio vai para uma pessoa em vez de "não entendi" (Regra B)  1401ms
   ✓ receber mensagem do WhatsApp > depois do handoff o bot fica calado  1693ms
   ✓ receber mensagem do WhatsApp > a conversa em andamento continua na versão em que começou  1731ms
   ✓ receber mensagem do WhatsApp > falha de entrega vira handoff, e não exceção sem dono  833ms
   ✓ receber mensagem do WhatsApp > entrega que falha no meio para o resto em vez de mandar fora de ordem  890ms
   ✓ receber mensagem do WhatsApp > encerrar o atendimento resolve o handoff e devolve o contato ao bot  2381ms
   ✓ receber mensagem do WhatsApp > duas mensagens ao mesmo tempo não criam duas sessões  1233ms
   ✓ receber mensagem do WhatsApp > monta o contexto de resposta com o canal em que a pessoa escreveu  903ms
   ✓ receber mensagem do WhatsApp > não monta contexto de resposta para o contato de outro cliente  885ms
   ✓ receber mensagem do WhatsApp > não encerra o atendimento de um contato pelo id de outro cliente  1564ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  14:59:00
   Duration  18.28s (transform 216ms, setup 0ms, collect 391ms, tests 17.55s, environment 0ms, prepare 92ms)
Passou — uma sessão. Reforço o teste com o que a pessoa veria: a saudação uma vez só.

Edit receber-mensagem.test.ts
Added 10 lines
Bash Verify test passes with lock and fails without
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npx vitest run src/server/receber-mensagem.test.ts -t "duas mensagens ao mesmo tempo" 2>&1 | tail -10
echo "=== e sem a trava, o teste reprovaria? (simulação) ==="
git stash push -q src/server/receber-mensagem.ts && npx vitest run src/server/receber-mensagem.test.ts -t "duas mensagens ao mesmo tempo" 2>&1 | grep -E "Tests |✓|×|AssertionError|Expected|Received|- 1|\+ 2" | head -8
git stash pop -q && echo "--- trava de volta ---"

OUT
 RUN  v3.2.7 /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos

 ✓ src/server/receber-mensagem.test.ts (15 tests | 14 skipped) 2200ms
   ✓ receber mensagem do WhatsApp > duas mensagens ao mesmo tempo não criam duas sessões  1351ms

 Test Files  1 passed (1)
      Tests  1 passed | 14 skipped (15)
   Start at  14:59:45
   Duration  3.00s (transform 236ms, setup 0ms, collect 412ms, tests 2.20s, environment 0ms, prepare 89ms)

=== e sem a trava, o teste reprovaria? (simulação) ===
   × receber mensagem do WhatsApp > duas mensagens ao mesmo tempo não criam duas sessões 937ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ …(2) ] to have a length of 1 but got 2
- Expected
+ Received
- 1
+ 2
      Tests  1 failed | 14 skipped (15)
--- trava de volta ---
A trava está provada nos dois sentidos. Agora o MAX_EFEITOS — e ele é menor do que eu previa no plano.

Bash Read end of resolver loop
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -n 172,196p src/server/efeitos/resolver.ts

OUT
      tipo: 'ia_respondeu',
      texto: resposta.texto,
    })

    resultado = {
      acoes: [...semEfeito(resultado.acoes, 'chamar_ia'), ...seguinte.acoes],
      sessao: seguinte.sessao,
    }
  }

  return resultado
}

/**
 * Tira o pedido de efeito da lista depois de atendido.
 *
 * Se ficasse, quem aplica as ações veria um pedido já respondido e mandaria a
 * conversa para um humano em cima de algo que deu certo.
 */
function semEfeito(acoes: Acao[], tipo: 'chamar_ia' | 'chamar_http'): Acao[] {
  return acoes.filter((a) => a.tipo !== tipo)
}

function ultimaDaPessoa(historico: Turno[] | undefined): string | undefined {
  return [...(historico ?? [])].reverse().find((t) => t.de === 'pessoa')?.texto
Edit resolver.ts
Added 26 lines
Bash Check existing MAX_EFEITOS test
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
grep -n "MAX_EFEITOS" src/server/efeitos/resolver.test.ts | head

OUT
12:const { executarComEfeitos, MAX_EFEITOS } = await import('./resolver')
269:    expect(chamarHttp).toHaveBeenCalledTimes(MAX_EFEITOS)
Bash Read the MAX_EFEITOS test
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
sed -n 248,278p src/server/efeitos/resolver.test.ts

OUT
    expect(chamarHttp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deTeste: false }),
    )
  })

  it('a trava para o encadeamento sem fim, e conta IA e API juntas', async () => {
    // Um bloco de API ligado em si mesmo: sem trava, o laço nunca sai daqui.
    const ciclo = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        { id: 'consulta', type: 'http', position: { x: 0, y: 0 }, data: { url: 'https://e.com' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'consulta', target: 'consulta' }],
    })
    chamarHttp.mockResolvedValue({ ok: true, valores: {} })

    await executarComEfeitos(ciclo, sessaoNova(), { tipo: 'inicio' }, semIa)

    expect(chamarHttp).toHaveBeenCalledTimes(MAX_EFEITOS)
  })

  it('IA e API no mesmo fluxo, cada uma atendida pelo seu resolvedor', async () => {
    const misto = fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
Edit resolver.test.ts
Added 10 lines
Bash Full verification
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
npm test 2>&1 | tail -6; echo "=== TYPECHECK ==="; npm run typecheck 2>&1 | tail -3; echo "=== LINT ==="; npm run lint 2>&1 | tail -4; echo "=== BUILD ==="; npm run build 2>&1 | grep -E "Compiled|error" | head -3

OUT
 Test Files  12 passed | 2 skipped (14)
      Tests  224 passed | 8 skipped (232)
   Start at  15:00:41
   Duration  21.32s (transform 1.38s, setup 0ms, collect 3.60s, tests 37.86s, environment 7ms, prepare 1.87s)

=== TYPECHECK ===
> autofluxos@0.0.1 typecheck
> tsc --noEmit

=== LINT ===

> autofluxos@0.0.1 lint
> eslint .

=== BUILD ===
✓ Compiled successfully in 18.6s
Bash Commit, push and watch CI
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
git add -A && git commit -q -F - <<'EOF' && git push -q origin main
fix: uma conversa por vez, por contato

Quem manda "oi" e "tudo bem?" em seguida gera dois webhooks, e nada
garante que o segundo espere o primeiro. Os dois leem a sessão no mesmo
estado; como o primeiro ainda não gravou, o segundo também conclui que a
conversa é nova e cria uma SEGUNDA sessão. A pessoa vê a saudação duas
vezes e a triagem recomeça do zero.

O teste veio antes e reprovou com duas sessões onde devia haver uma.
Está no commit, e reprova de novo se a trava sair.

A trava é uma tabela com prazo (migration 0007), não `pg_advisory_lock`:
o advisory lock vive preso à conexão e o Supabase serve por pooler — a
conexão que pega não é necessariamente a que solta, e uma que morre
segurando deixa o contato mudo até o pooler reciclar. Um
`insert ... on conflict do update ... where` é uma instrução só, e é
isso que a torna atômica.

Quem não pega a vez espera, com recuo, até vinte segundos. Desistir de
cara seria pior: a mensagem já foi deduplicada em `registrarEntrada`, e
sem resposta a Meta não reenvia. Vinte segundos cabem no orçamento de
60s do webhook; o que não couber é coisa presa, não fila — e aí vira
handoff, para a pessoa ao menos aparecer na tela de leads.

A dedupe continua ANTES da trava: reenvio não precisa esperar fila
nenhuma para ser descartado.

Junto, um motivo honesto: estourar `MAX_EFEITOS` ia parar em `aplicar()`
dizendo "a integração não chegou a ser executada" — verdade pela metade,
que manda quem investiga procurar defeito na integração em vez de ciclo
no desenho. Agora o motivo diz o que houve.

224 testes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
gh run watch $(sleep 6; gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status 2>&1 | tail -10

OUT
  ✓ Run actions/checkout@v5
  ✓ Run actions/setup-node@v5
  ✓ Run npm ci
  ✓ Tipos
  ✓ Lint
  ✓ Testes
  ✓ Build
  ✓ Post Run actions/setup-node@v5
  ✓ Post Run actions/checkout@v5
  ✓ Complete job
CI verde. Falta a última peça do bloco 2: mensagem enviada e não registrada.

Write 0008_entrega.sql
64 lines
-- 0008 — a mensagem foi mesmo entregue?
--
-- Até aqui, uma saída era gravada **depois** de sair: `enviarTexto` e então
-- `registrarSaida`. Entre uma coisa e outra existe uma janela — curta, mas real
-- num `after()` que pode bater no `maxDuration` de 60s no meio de um fluxo
-- lento. A função morre ali e a mensagem foi entregue à pessoa sem existir no
-- histórico. Quem abre a tela do lead vê uma conversa com um buraco, e é
-- justamente quando ela mais precisa saber o que o bot disse.
--
-- A ordem inverte: grava primeiro como não confirmada, manda, e confirma. As
-- duas mortes possíveis passam a ser honestas — morreu antes de mandar, fica
-- "não confirmado" e não foi; morreu depois, fica "não confirmado" e foi. A
-- tela nunca afirma o que não sabe, e nunca esconde o que existiu.
--
-- `default true` porque tudo que já está na tabela foi gravado sob a regra
-- antiga (só depois de sair), e porque mensagem de **entrada** nunca precisa
-- de confirmação — ela chegou, é o webhook contando que chegou.

alter table public.messages
  add column if not exists entregue boolean not null default true;

comment on column public.messages.entregue is
  'Falso enquanto o envio não é confirmado. Sempre verdadeiro para direcao = entrada.';

-- A view de leads mostra a última mensagem da conversa na lista. Sem carregar
-- a confirmação junto, a tela mostraria como dita uma mensagem que talvez não
-- tenha saído — que é exatamente o que esta migration existe para evitar.
create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  ultima.entregue  as ultima_entregue,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true;

revoke all on public.leads from anon, authenticated;

notify pgrst, 'reload schema';
Bash Apply migration 0008 and verify
IN
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
S=/tmp/claude-1000/-home-gabrielbarbosa-dev-gabriel-4yu-apps-autofluxos/b5a98362-0c59-4bc7-b80e-727db04939cc/scratchpad
python3 -c "import json;print(json.dumps({'query': open('supabase/migrations/0008_entrega.sql').read()}))" > $S/mig8.json
curl -s -X POST "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data @$S/mig8.json | head -c 300
echo; echo "--- conferindo ---"
curl -s -X POST "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select column_name from information_schema.columns where table_name in ('"'"'messages'"'"','"'"'leads'"'"') and column_name in ('"'"'entregue'"'"','"'"'ultima_entregue'"'"');"}'

OUT
{"message":"Failed to run sql query: ERROR:  42P16: cannot change name of view column \"handoff_motivo\" to \"ultima_entregue\"\nHINT:  Use ALTER VIEW ... RENAME COLUMN ... to change name of view column instead.\n"}
--- conferindo ---
[]
create or replace view não deixa inserir coluna no meio — só no fim. Ajusto.

Edit 0008_entrega.sql
Added 6 lines
Bash Apply migration 0008
IN
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
S=/tmp/claude-1000/-home-gabrielbarbosa-dev-gabriel-4yu-apps-autofluxos/b5a98362-0c59-4bc7-b80e-727db04939cc/scratchpad
python3 -c "import json;print(json.dumps({'query': open('supabase/migrations/0008_entrega.sql').read()}))" > $S/mig8.json
curl -s -X POST "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data @$S/mig8.json | head -c 200
echo; echo "--- conferindo ---"
curl -s -X POST "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select table_name, column_name from information_schema.columns where (table_name='"'"'messages'"'"' and column_name='"'"'entregue'"'"') or (table_name='"'"'leads'"'"' and column_name='"'"'ultima_entregue'"'"');"}'

OUT
[]
--- conferindo ---
[{"table_name":"leads","column_name":"ultima_entregue"},{"table_name":"messages","column_name":"entregue"}]
Migration aplicada. Agora o código: gravar antes, mandar, confirmar.

Edit conversas.ts
Added 27 lines
Bash Wire confirmarEntrega into aplicar
IN
cd /home/gabrielbarbosa/dev/gabriel/4yu-apps/autofluxos
python3 - <<'PY'
import pathlib