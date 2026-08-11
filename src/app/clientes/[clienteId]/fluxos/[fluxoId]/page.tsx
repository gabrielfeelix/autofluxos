import { notFound } from 'next/navigation'
import { Simulador } from '@/components/simulador'
import { validar } from '@/core/flow/validar'
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

  // A mesma validação que vai bloquear o botão "Publicar" no passo 5.
  const validacao = validar(fluxo.rascunho)

  return (
    <Simulador
      fluxo={fluxo.rascunho}
      validacao={validacao}
      titulo={fluxo.nome}
      subtitulo={cliente.nome}
      voltarHref={`/clientes/${cliente.id}`}
    />
  )
}
