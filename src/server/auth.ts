import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
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
let poolCache: Pool | null = null

/**
 * O pool, criado uma vez e compartilhado.
 *
 * Exportado porque o login trouxe **duas** perguntas que o PostgREST não
 * responde: "já existe algum usuário?" (o cadastro do primeiro administrador
 * precisa saber, antes de existir sessão que o autorize a perguntar) e as
 * junções entre `af_membros` e `af_usuarios` que as telas do administrador
 * mostram. Abrir um segundo pool para isso multiplicaria conexões contra um
 * pooler que já é o gargalo — a `max: 1` acima existe justamente para isso não
 * acontecer.
 *
 * Quem usa daqui escreve SQL, então vale a regra da casa: identificador nunca
 * vem de usuário, valor sempre vai como parâmetro (`$1`).
 */
export function bancoDoLogin(): Pool {
  if (poolCache) return poolCache

  const url = process.env.DATABASE_URL
  if (!url) {
    // Falha barulhenta e cedo. Sem isto o erro apareceria no primeiro login
    // como uma exceção do driver, que não diz o que está faltando.
    throw new Error('DATABASE_URL não está configurada — o login não funciona sem ela')
  }
  poolCache = new Pool({ connectionString: url, max: 1 })
  return poolCache
}

/**
 * Os nomes das tabelas carregam o produto, e isso é correção de um erro nosso.
 *
 * O Better Auth criaria `user`, `session`, `account` e `verification` — nomes
 * genéricos demais para um projeto que hospeda dois produtos. O bucket `logos`
 * nasceu sem prefixo e hoje não dá para renomear sem quebrar toda `logo_url`
 * gravada; aqui a gente não repete.
 */
function montar() {
  return betterAuth({
    database: bancoDoLogin(),
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

      /**
       * **Precisa ser o último da lista, e não é detalhe de ordenação.**
       *
       * `nextCookies()` é um gancho `after` que pega o `Set-Cookie` que os
       * endpoints produzem e o repassa para o `cookies()` do Next. Sem ele,
       * `signInEmail` chamado de dentro de uma Server Action autentica e **não
       * deixa sessão nenhuma no navegador** — a pessoa preenche a senha certa,
       * a ação responde 200 e a tela seguinte a manda de volta para o login.
       *
       * Ele precisa rodar depois dos ganchos dos outros plugins porque o cookie
       * que interessa é o que sobrou no fim da cadeia: a impersonação, por
       * exemplo, troca o cookie de sessão dentro do gancho dela.
       */
      nextCookies(),
    ],
  })
}

/**
 * **É função, e não uma constante, porque `pool()` estoura sem `DATABASE_URL`.**
 *
 * Com `export const auth = betterAuth(...)`, o simples `import` deste arquivo
 * executa o construtor — e o `npm run build` do CI roda **sem** variável de
 * banco nenhuma (ver `.github/workflows/ci.yml`, que não passa segredo de
 * propósito, porque este repositório é público). Enquanto nada importava este
 * módulo o build passava; a primeira rota que o importasse derrubaria o CI.
 *
 * Adiar a construção para a primeira chamada mantém as duas coisas: o build
 * segue verde onde não há banco, e quem tenta **usar** o login sem
 * `DATABASE_URL` continua recebendo a mensagem que diz exatamente o que falta.
 */
let instancia: ReturnType<typeof montar> | null = null

export function autenticacao(): ReturnType<typeof montar> {
  if (!instancia) instancia = montar()
  return instancia
}

export type Sessao = ReturnType<typeof montar>['$Infer']['Session']
