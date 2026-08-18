import { autenticacao } from '@/server/auth'

/**
 * A porta do Better Auth: `/api/auth/*`.
 *
 * Tudo que o login faz passa por aqui — entrar, sair, criar conta, trocar de
 * companhia, entrar como outra pessoa. A biblioteca resolve o caminho depois
 * do prefixo sozinha; o `[...all]` só entrega a requisição inteira para ela.
 *
 * **Por que não `toNextJsHandler(autenticacao())`**, que é o atalho da
 * biblioteca: ele quer a instância **agora**, no corpo do módulo, e construir a
 * instância abre o pool do Postgres. O `npm run build` do CI roda sem
 * `DATABASE_URL` (o repositório é público e não guarda segredo), e o import
 * deste arquivo derrubaria o build inteiro antes de qualquer requisição
 * existir. Chamar `autenticacao()` **dentro** de cada método adia isso para o
 * primeiro acesso de verdade — que é onde a falta da variável precisa aparecer.
 *
 * O que `toNextJsHandler` faz de resto é exatamente isto: repassar `request`
 * para `auth.handler`. Os cinco verbos existem porque plugin pode registrar
 * endpoint em qualquer um deles, e um 405 aqui apareceria como "o login parou
 * de funcionar" sem dizer por quê.
 */
function responder(request: Request): Promise<Response> {
  return autenticacao().handler(request)
}

export const GET = responder
export const POST = responder
export const PUT = responder
export const PATCH = responder
export const DELETE = responder
