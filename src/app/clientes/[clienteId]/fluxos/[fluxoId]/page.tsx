import { notFound } from 'next/navigation'
import { Editor } from '@/components/editor/editor'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes } from '@/server/repos/conexoes'
import { acharFluxo, acharVersao } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

/**
 * Formatado aqui, no servidor, e não no editor: data relativa calculada no
 * cliente diverge do que o servidor renderizou (fuso e relógio diferentes) e o
 * React reclama de hidratação. O editor só exibe a string pronta.
 */
function quando(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; fluxoId: string }>
}) {
  const { clienteId, fluxoId } = await params

  const [cliente, fluxo, conexoes] = await Promise.all([
    acharCliente(clienteId),
    acharFluxo(fluxoId),
    listarConexoes(clienteId),
  ])
  if (!cliente || !fluxo || fluxo.clienteId !== cliente.id) notFound()

  const publicada = fluxo.versaoPublicadaId ? await acharVersao(fluxo.versaoPublicadaId) : null

  return (
    <Editor
      fluxoId={fluxo.id}
      clienteId={cliente.id}
      nome={fluxo.nome}
      clienteNome={cliente.nome}
      voltarHref={`/clientes/${cliente.id}`}
      inicial={fluxo.rascunho}
      iaHabilitada={fluxo.iaHabilitada}
      contextoNegocio={cliente.contextoNegocio}
      temContextoDeNegocio={cliente.contextoNegocio.trim() !== ''}
      conexoes={conexoes}
      publicadaInicial={
        publicada
          ? { versao: publicada.versao, quando: quando(publicada.publicadoEm), grafo: publicada.grafo }
          : null
      }
    />
  )
}
