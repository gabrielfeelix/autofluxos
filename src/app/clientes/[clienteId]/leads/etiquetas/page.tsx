import { redirect } from 'next/navigation'

/** Endereço antigo: Etiquetas voltou para Configurações em 26/set. */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  redirect(`/clientes/${clienteId}/ajustes/etiquetas`)
}
