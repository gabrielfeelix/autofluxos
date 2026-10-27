import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Miolo } from '@/components/design/miolo'
import { SemAcesso } from '@/components/design/sem-acesso'
import { QuadroDePedidos } from '@/components/pedidos/quadro-de-pedidos'
import { pacoteDo, rotuloNaBarra } from '@/core/nichos'
import { STATUS_DE_PEDIDO, etapasDoRamo, pedidosDoRamo, rotuloDoStatus, type StatusDePedido } from '@/core/pedidos'
import { cartoesDosPedidos, estadoDosModelosDoPedido } from '@/server/pedidos'
import { capacidadeNaPagina } from '@/server/permissoes'
import { acharCliente } from '@/server/repos/clientes'
import { nichoDaConta } from '@/server/repos/recursos'

export const dynamic = 'force-dynamic'

/**
 * Comércio > Pedidos (0146): o que foi pedido pela conversa, por etapa.
 *
 * Abre em quadro no restaurante, onde a cozinha acompanha de longe, e em lista
 * nos outros ramos; as duas a um clique. Aulas não tem Pedidos no menu, mas a
 * rota direta abre, vazia, como toda tela escondida pelo ramo.
 *
 * Ver é de quem atende; o total só aparece para quem vê valores.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, nicho] = await Promise.all([acharCliente(clienteId), nichoDaConta(clienteId)])
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'atender', 'proprios')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Pedidos" />
      </ClienteShell>
    )
  }

  const verValores = (await capacidadeNaPagina(clienteId, 'ler_valores', 'todos')) !== null
  const [cartoes, estadoDosModelos, podeCriarModelos] = await Promise.all([
    cartoesDosPedidos(clienteId, verValores),
    estadoDosModelosDoPedido(clienteId).catch(() => 'aprovados' as const),
    capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos'),
  ])
  const rotulos = Object.fromEntries(STATUS_DE_PEDIDO.map((s) => [s, rotuloDoStatus(s, nicho)])) as Record<
    StatusDePedido,
    string
  >
  const comercio = rotuloNaBarra(pacoteDo(nicho), 'loja', 'Comércio')

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <Miolo largura="cheia">
        <QuadroDePedidos
          clienteId={clienteId}
          inicial={cartoes}
          etapas={etapasDoRamo(nicho)}
          rotulos={rotulos}
          visaoInicial={pedidosDoRamo(nicho)?.visao ?? 'lista'}
          modelos={{ estado: estadoDosModelos, podeCriar: podeCriarModelos !== null }}
          topo={{
            trilha: [{ rotulo: comercio }, { rotulo: 'Pedidos' }],
            titulo: 'Pedidos',
            descricao:
              'Os pedidos da conversa, do cardápio digital e do link do entregador. O pagamento confirmado leva o pedido para Pago sozinho; as outras etapas a equipe muda aqui, e o cliente é avisado no WhatsApp.',
          }}
        />
      </Miolo>
    </ClienteShell>
  )
}
