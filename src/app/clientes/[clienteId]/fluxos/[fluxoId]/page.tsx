import { notFound } from 'next/navigation'
import { Editor } from '@/components/editor/editor'
import { acharCliente } from '@/server/repos/clientes'
import { acharFluxo } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; fluxoId: string }>
}) {
  const { clienteId, fluxoId } = await params

  const [cliente, fluxo] = await Promise.all([acharCliente(clienteId), acharFluxo(fluxoId)])
  if (!cliente || !fluxo || fluxo.clienteId !== cliente.id) notFound()

  return (
    <Editor
      fluxoId={fluxo.id}
      nome={fluxo.nome}
      clienteNome={cliente.nome}
      voltarHref={`/clientes/${cliente.id}`}
      inicial={fluxo.rascunho}
    />
  )
}
