import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ConectarFoody } from '@/components/loja/conectar-foody'
import { MODELO_DE_RASTREIO } from '@/core/modelos-do-pedido'
import { tokenDoWebhook } from '@/server/cardapios/token-do-webhook'
import { estadoDosModelosDoPedido } from '@/server/pedidos'
import { capacidadeNaPagina } from '@/server/permissoes'
import { cardapioDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

const ENDERECO_DO_GATILHO = 'https://dialogon.com.br/api/webhook/foody/'

/**
 * Integrações > Cardápio e delivery > Foody Delivery. O token e o gatilho
 * são de quem configura a operação; o token do gatilho só é montado aqui, no
 * servidor, para quem pode ver.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Foody Delivery" />
      </ClienteShell>
    )
  }

  const cardapio = await cardapioDaConta(clienteId, 'foody')
  const ligado = cardapio?.ativo && cardapio.conexaoId ? cardapio : null
  const modelo = ligado ? await estadoDosModelosDoPedido(clienteId, [MODELO_DE_RASTREIO]).catch(() => 'faltam' as const) : 'faltam'

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarFoody
        clienteId={clienteId}
        conectado={
          ligado
            ? {
                avisarCliente: ligado.avisarCliente,
                ultimaLeitura: ligado.pedidosLidosAte,
                gatilho: { url: `${ENDERECO_DO_GATILHO}${clienteId}`, token: tokenDoWebhook(clienteId, 'foody') },
                modeloDeRastreio: modelo,
              }
            : null
        }
      />
    </ClienteShell>
  )
}
