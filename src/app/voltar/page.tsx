import { redirect } from 'next/navigation'
import { destinoAposEntrar } from '@/server/permissoes'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * "Voltar" das telas de erro e de não encontrado (S12).
 *
 * Elas apontavam sempre para `/painel`, que era a lista de organizações do
 * administrador da plataforma; quem é de uma conta só era redirecionado de
 * lá para `/contas`, um passo a mais e um rótulo que não era dele. Aqui o
 * destino é o mesmo de quem acaba de entrar: a conta, quando é uma só;
 * `/contas`, quando são várias; `/admin`, para o suporte 4YU. Sem
 * sessão, o `proxy.ts` já manda para `/entrar` antes de chegar aqui.
 */
export default async function Pagina() {
  const sessao = await sessaoAtual()
  redirect(sessao ? await destinoAposEntrar(sessao) : '/entrar')
}
