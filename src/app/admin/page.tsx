import { redirect } from 'next/navigation'

/**
 * **Sem isto o Next prerenderiza esta rota**, e a moldura roda no build — sem
 * banco, sem cookie, sem sessão. O `exigirAdminDaPlataforma()` do layout falha
 * e o que fica gravado é um redirecionamento para a raiz, servido depois a
 * quem *é* administrador. Uma tela de autorização nunca pode ser estática.
 */
export const dynamic = 'force-dynamic'

/**
 * `/admin` não tem tela própria, e não vai ter só para existir.
 *
 * Um painel de administração que abre num resumo de números que ninguém
 * consulta é a superfície que o plano manda evitar. A primeira pergunta de
 * quem entra aqui é sempre "quais contas existem", então é para lá que ele vai.
 */
export default function Admin() {
  redirect('/admin/contas')
}
