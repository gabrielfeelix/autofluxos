import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Assistente } from '@/components/onboarding/assistente'
import { capacidadeNaPagina } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'
import { acharCliente } from '@/server/repos/clientes'
import { listarQuadros } from '@/server/repos/quadros'
import { listarFluxos } from '@/server/repos/fluxos'
import { onboardingDaConta } from '@/server/repos/onboarding'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  if (!(await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos'))) {
    const cliente = await acharCliente(clienteId)
    if (!cliente) notFound()
    return <ClienteShell cliente={cliente} ativa="ajustes"><SemAcesso clienteId={clienteId} oQue="a configuração guiada" /></ClienteShell>
  }
  const [cliente, estado, quadros, fluxos] = await Promise.all([
    acharCliente(clienteId), onboardingDaConta(clienteId), listarQuadros(clienteId), listarFluxos(clienteId),
  ])
  if (!cliente) notFound()
  return <ClienteShell cliente={cliente} ativa="ajustes"><Assistente clienteId={clienteId} nome={cliente.nome} inicial={estado} temQuadro={quadros.length > 0} temFluxo={fluxos.length > 0} /></ClienteShell>
}
