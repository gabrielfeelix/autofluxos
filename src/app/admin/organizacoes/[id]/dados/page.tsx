import { notFound } from 'next/navigation'
import { FichaDoCliente } from '@/components/cliente/ficha'
import { acaoAdminRemoverLogo, acaoAdminSalvarCadastro, acaoAdminSalvarLogo } from '@/server/acoes-admin'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * Dados: a mesma ficha de Configurações > Dados da organização, com as ações
 * da administração (que conferem a plataforma e registram na auditoria).
 */
export default async function Dados({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharCliente(id)
  if (!organizacao) notFound()

  return (
    <div className="max-w-[1100px]">
      <FichaDoCliente
        cliente={organizacao}
        podeEditar
        daPlataforma
        salvarCadastro={acaoAdminSalvarCadastro.bind(null, organizacao.id)}
        salvarLogo={acaoAdminSalvarLogo.bind(null, organizacao.id)}
        removerLogo={acaoAdminRemoverLogo.bind(null, organizacao.id)}
      />
    </div>
  )
}
