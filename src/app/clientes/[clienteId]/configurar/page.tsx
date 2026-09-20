import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Assistente } from '@/components/onboarding/assistente'
import { exigirCapacidadeNaPagina } from '@/server/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarQuadros } from '@/server/repos/quadros'
import { listarFluxos } from '@/server/repos/fluxos'
import { onboardingDaConta } from '@/server/repos/onboarding'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  await exigirCapacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  const [cliente, estado, quadros, fluxos] = await Promise.all([
    acharCliente(clienteId), onboardingDaConta(clienteId), listarQuadros(clienteId), listarFluxos(clienteId),
  ])
  if (!cliente) notFound()
  return <ClienteShell cliente={cliente} ativa="ajustes"><Assistente clienteId={clienteId} nome={cliente.nome} inicial={estado} temQuadro={quadros.length > 0} temFluxo={fluxos.length > 0} /></ClienteShell>
}
