/**
 * Imprime o schema que o Better Auth **instalado** espera.
 *
 * Existe porque o `@better-auth/cli` é publicado à parte e fica para trás: em
 * 17/ago o CLI mais novo era `1.5.0-beta.13` enquanto o runtime já estava em
 * `1.7.0`, e o schema que ele gerou não tinha a coluna `issuer` de `af_contas`.
 * O erro só apareceu no primeiro `signUp`, como
 * `column "issuer" of relation "af_contas" does not exist`.
 *
 * A fonte da verdade é o runtime. Rode isto ao atualizar a biblioteca e compare
 * com o banco antes de acreditar que nada mudou:
 *
 *     node scripts/schema-do-auth.mjs
 *
 * Ele não escreve migration: mostra o que deveria existir. Escrever o SQL
 * continua sendo trabalho de gente, porque é onde entram `public.`, RLS e os
 * `revoke` que a biblioteca não conhece (ver docs/BANCO-COMPARTILHADO.md).
 */
import { getAuthTables } from 'better-auth/db'
import { admin } from 'better-auth/plugins'

// Precisa espelhar `src/server/auth.ts`. Divergir aqui faz o script mentir.
const tabelas = getAuthTables({
  user: { modelName: 'af_usuarios' },
  session: { modelName: 'af_sessoes' },
  account: { modelName: 'af_contas' },
  verification: { modelName: 'af_verificacoes' },
  plugins: [admin({ impersonationSessionDuration: 3600 })],
})

for (const [chave, tabela] of Object.entries(tabelas)) {
  console.log(`\n### ${chave} -> ${tabela.modelName}`)
  for (const [nome, campo] of Object.entries(tabela.fields)) {
    const partes = [
      (campo.fieldName ?? nome).padEnd(24),
      String(campo.type).padEnd(10),
      campo.required ? 'NOT NULL' : 'null',
      campo.unique ? 'UNIQUE' : '',
      campo.references
        ? `-> ${campo.references.model}.${campo.references.field} ${campo.references.onDelete ?? ''}`
        : '',
      campo.defaultValue !== undefined ? 'has-default' : '',
    ]
    console.log('  ' + partes.filter(Boolean).join(' '))
  }
}
