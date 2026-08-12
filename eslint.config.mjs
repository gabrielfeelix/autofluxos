import js from '@eslint/js'
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
  js.configs.recommended,
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
