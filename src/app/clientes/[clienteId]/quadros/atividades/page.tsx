import { redirect } from 'next/navigation'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  redirect(`/clientes/${clienteId}/atividades`)
}
