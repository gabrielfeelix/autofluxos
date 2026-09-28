/**
 * A porta HTTP do Better Auth, `/api/auth/*`: **fechada de propósito.**
 *
 * Nenhuma tela deste painel fala com o Better Auth por HTTP. Entrar, sair,
 * cadastrar, criar conta, adicionar membro e entrar como outra pessoa são
 * Server Actions que chamam `autenticacao().api.*` no servidor
 * (`acoes-conta.ts`, `acoes-pessoas.ts`, `acoes-admin.ts`), e a sessão é lida
 * com `getSession` no servidor. O cookie continua sendo gravado pelo plugin
 * `nextCookies`, que age dentro da Server Action e não precisa desta rota.
 *
 * **Por que fechar em vez de deixar como estava** (auditoria de 28/set/2026):
 * com o `handler` inteiro exposto, cada endpoint da biblioteca virava uma
 * segunda porta ao lado da nossa, e a segunda porta não tem nenhuma das regras
 * da primeira:
 *
 * - `POST /api/auth/sign-in/email` fazia login **sem** o `consumirLimite` de
 *   `acaoEntrar`. O limitador da biblioteca guarda contagem em memória, e na
 *   Vercel cada instância nasce zerada: força bruta de senha sem teto real.
 * - `POST /api/auth/sign-up/email` cadastrava sem o limite de `acaoCadastrarSe`.
 * - `POST /api/auth/organization/create` inseria linha em `clients` sem passar
 *   pelo plano, e `organization/delete`, `update-member-role` e
 *   `remove-member` mexiam em conta e papel sem a conferência de suspensão e
 *   de papel que `sessao.ts` faz.
 *
 * Se um dia uma tela precisar de um endpoint daqui (login social, por exemplo,
 * que exige callback HTTP), ele entra numa lista explícita e com o mesmo
 * limitador das Server Actions. Abrir o `handler` inteiro de novo é reabrir
 * todas as portas acima de uma vez.
 */
function fechada(): Response {
  return new Response(null, { status: 404 })
}

export const GET = fechada
export const POST = fechada
export const PUT = fechada
export const PATCH = fechada
export const DELETE = fechada
