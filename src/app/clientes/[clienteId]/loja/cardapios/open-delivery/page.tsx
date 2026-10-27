import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ConectarOpenDelivery } from '@/components/loja/conectar-open-delivery'
import { capacidadeNaPagina } from '@/server/permissoes'
import { cardapioDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/** Integrações > Cardápio e delivery > Open Delivery. A credencial é de quem configura a operação. */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Open Delivery" />
      </ClienteShell>
    )
  }

  const cardapio = await cardapioDaConta(clienteId, 'opendelivery')
  const ligado = cardapio?.ativo && cardapio.conexaoId ? cardapio : null

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarOpenDelivery
        clienteId={clienteId}
        conectado={
          ligado ? { origem: ligado.idNaPlataforma ?? '', avisarCliente: ligado.avisarCliente, ultimaLeitura: ligado.pedidosLidosAte } : null
        }
      />
    </ClienteShell>
  )
}
