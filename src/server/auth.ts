import 'server-only'
import { betterAuth } from 'better-auth'
import { admin, organization } from 'better-auth/plugins'
import { Pool } from 'pg'

/**
 * Login por usuário.
 *
 * **Este é o único lugar do código que fala Postgres direto.** Todo o resto usa
 * `supabase-js` por cima do PostgREST (ver `server/db.ts`); o Better Auth usa
 * Kysely e precisa de conexão de verdade. Dois caminhos para o mesmo banco é
 * dívida consciente — a alternativa era escrever hash de senha, recuperação,
 * convite e impersonação à mão, que é onde erro custa caro.
 *
 * A escolha e o que foi descartado estão em `docs/PLANO-SISTEMA.md` §4.1. O
 * resumo: o projeto Supabase é compartilhado com a Verandi, e `auth.users`,
 * SMTP e URLs de redirect são globais aos dois produtos. O Better Auth cria as
 * tabelas dele no **nosso** schema e nunca encosta em `auth.users`.
 */

/**
 * O pool aponta para o **pooler de transação (6543)**, não para a porta 5432.
 *
 * É o modo próprio para serverless: a Vercel abre e fecha função o tempo todo, e
 * conexão direta esgotaria o Postgres. O preço é que em modo transação o
 * Supavisor **não suporta prepared statements** — o `node-postgres` só os usa
 * quando a consulta tem `name`, e nem o Better Auth nem nós fazemos isso, mas
 * fica registrado para quem for acrescentar consulta nova aqui.
 *
 * `max: 1` porque cada instância serverless é efêmera: guardar dez conexões
 * ociosas por instância é o caminho mais rápido para estourar o pooler.
 */
function pool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    // Falha barulhenta e cedo. Sem isto o erro apareceria no primeiro login
    // como uma exceção do driver, que não diz o que está faltando.
    throw new Error('DATABASE_URL não está configurada — o login não funciona sem ela')
  }
  return new Pool({ connectionString: url, max: 1 })
}

/**
 * Os nomes das tabelas carregam o produto, e isso é correção de um erro nosso.
 *
 * O Better Auth criaria `user`, `session`, `account` e `verification` — nomes
 * genéricos demais para um projeto que hospeda dois produtos. O bucket `logos`
 * nasceu sem prefixo e hoje não dá para renomear sem quebrar toda `logo_url`
 * gravada; aqui a gente não repete.
 */
export const auth = betterAuth({
  database: pool(),
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    // Ligar verificação por e-mail exige SMTP, que é **global ao projeto
    // compartilhado**. Fica para quando o convite existir, e aí avaliado nos
    // dois produtos (ver BANCO-COMPARTILHADO.md).
    requireEmailVerification: false,
    minPasswordLength: 10,
  },

  /**
   * Ids em uuid, e isto não é preferência estética.
   *
   * A organização do plugin **é** a nossa tabela `clients`, cujo `id` é uuid
   * desde a 0001 e para onde apontam `flows`, `contacts`, `channels`,
   * `connections` e `messages`. Com o gerador padrão do Better Auth (um id
   * curto próprio), todo insert de conta quebraria no casamento de tipos.
   */
  advanced: { database: { generateId: 'uuid' } },

  user: { modelName: 'af_usuarios' },
  session: {
    modelName: 'af_sessoes',
    // Sete dias, renovando a cada dia de uso. O painel é ferramenta de
    // trabalho: expirar todo dia treina a pessoa a odiar o login, e não
    // expirar nunca deixa sessão viva em máquina emprestada.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: { modelName: 'af_contas' },
  verification: { modelName: 'af_verificacoes' },

  plugins: [
    /**
     * Impersonação — o "entrar como" do administrador.
     *
     * Uma hora de prazo, e o plugin grava `impersonatedBy` **na própria
     * sessão**. É a boa prática do recurso vindo por construção: sessão do
     * admin separada da impersonada, prazo curto, e registro de quem entrou na
     * conta de quem sem nunca pedir a senha de ninguém.
     */
    admin({ impersonationSessionDuration: 60 * 60 }),

    /**
     * A conta do cliente — e ela **é** a nossa `clients`, não uma tabela ao
     * lado.
     *
     * Aceitar a `organization` própria do plugin deixaria duas tabelas para o
     * mesmo conceito: a nossa, com todas as chaves estrangeiras do sistema, e a
     * dele, com membros e convites. Duas listas de conta divergem, e é o mesmo
     * defeito que a 0018 consertou no nome do contato.
     *
     * `creatorRole: 'owner'` porque quem cria a conta é o dono dela. O papel de
     * **plataforma** (administrador da 4YU) é outra coisa e mora em
     * `af_usuarios.role`.
     */
    organization({
      schema: {
        organization: {
          modelName: 'clients',
          fields: { name: 'nome', logo: 'logo_url', createdAt: 'criado_em' },
        },
        member: { modelName: 'af_membros' },
        invitation: { modelName: 'af_convites' },
      },
      creatorRole: 'owner',
      // Um usuário pode ter mais de uma companhia (print 24). O teto existe
      // para um bug de laço não criar mil contas em silêncio, não para limitar
      // ninguém de verdade.
      organizationLimit: 20,
    }),
  ],
})

export type Sessao = typeof auth.$Infer.Session
