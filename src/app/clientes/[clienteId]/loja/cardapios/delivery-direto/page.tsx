import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ConectarDeliveryDireto } from '@/components/loja/conectar-delivery-direto'
import { deliveryDiretoLiberado } from '@/server/cardapios/delivery-direto'
import { capacidadeNaPagina } from '@/server/permissoes'
import { cardapioDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * Integrações > Cardápio e delivery > Delivery Direto. O acesso é de quem
 * configura a operação. Sem o `client_id` de integrador no ambiente, a página
 * não existe: a ficha segue "Em breve".
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente || !deliveryDiretoLiberado()) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Delivery Direto" />
      </ClienteShell>
    )
  }

  const cardapio = await cardapioDaConta(clienteId, 'delivery_direto')
  const ligado = cardapio?.ativo && cardapio.conexaoId ? cardapio : null

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarDeliveryDireto
        clienteId={clienteId}
        conectado={
          ligado ? { loja: ligado.idNaPlataforma ?? '', avisarCliente: ligado.avisarCliente, ultimaLeitura: ligado.pedidosLidosAte } : null
        }
      />
    </ClienteShell>
  )
}
