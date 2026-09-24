import { redirect } from 'next/navigation'
import { ehAdminDaPlataforma, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * O endereço antigo da lista de organizações.
 *
 * Ela virou a Visão geral da administração (`/admin`), dentro da mesma casca
 * das outras telas da plataforma. O endereço continua respondendo porque há
 * links salvos, retornos de WhatsApp e Instagram e favoritos apontando para
 * cá: quem administra cai na Visão geral, quem não administra cai nas
 * organizações dele.
 */
export default async function Pagina() {
  const sessao = await sessaoAtual()
  redirect(sessao && ehAdminDaPlataforma(sessao) ? '/admin' : '/contas')
}
