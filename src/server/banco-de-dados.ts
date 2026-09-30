import 'server-only'
import { Pool } from 'pg'

/**
 * O pool do SQL direto que **não** é login: relatórios, análise de vendas, a
 * lista de organizações, juntar etiquetas, remover membro.
 *
 * Existe porque `bancoDoLogin()` entra como `autofluxos_login` (0111), que só
 * enxerga as tabelas do login. Este entra como `autofluxos_dados` (0115): lê
 * as tabelas de relatório e escreve só o que as duas transações acima pedem,
 * sem alcançar os segredos do login nem nada fora de `public`.
 *
 * Mesmas regras do outro pool (ver `auth.ts`): pooler de transação (6543),
 * `max: 1`, nada de consulta com `name`, valor sempre como parâmetro.
 *
 * Sem `DATABASE_URL_DADOS` cai no `DATABASE_URL`, que é o caso do ambiente
 * local (lá ele é o `postgres`). Em produção a variável tem que existir: sem
 * ela, estas consultas voltam a dar `permission denied`.
 */
let poolCache: Pool | null = null

export function bancoDeDados(): Pool {
  if (poolCache) return poolCache

  const url = process.env.DATABASE_URL_DADOS || process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL_DADOS não está configurada, relatórios e administração não funcionam sem ela')
  }
  poolCache = new Pool({ connectionString: url, max: 1 })
  return poolCache
}
