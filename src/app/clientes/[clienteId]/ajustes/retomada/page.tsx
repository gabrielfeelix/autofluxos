import { redirect } from 'next/navigation'

/**
 * A tela virou uma seção de "Horário de atendimento".
 *
 * O redirecionamento fica: o endereço já foi mandado em conversa e está no
 * histórico de quem usa. Uma tela que some sem deixar rastro vira 404 para
 * quem guardou o link, e 404 numa configuração parece que a configuração
 * sumiu junto.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  redirect(`/clientes/${clienteId}/ajustes/horario`)
}
