import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ConectarLoja } from '@/components/loja/conectar-loja'
import {
  FICHAS,
  PLATAFORMAS_DE_LOJA,
  estadoDaPlataforma,
  ordenarPlataformas,
} from '@/core/plataformas-de-loja'
import { acaoQueroEstaPlataforma } from '@/server/acoes-loja'
import { acharCliente } from '@/server/repos/clientes'
import { lojaDaConta, pedidosDeLoja } from '@/server/repos/lojas'

export const dynamic = 'force-dynamic'

/**
 * Loja > Conectar loja: um cartão por plataforma (plano de navegação e CRM,
 * 5.6, F4).
 *
 * Substitui o 307 de `/loja` para `/loja/magento` que a F1 deixou até esta
 * tela existir. A ordem e o estado de cada cartão são regra pura
 * (`core/plataformas-de-loja.ts`); aqui só se lê o que a conta tem: a loja
 * Magento (a única que conecta hoje) e os "Quero esta" já dados.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [magento, pedidos] = await Promise.all([lojaDaConta(cliente.id), pedidosDeLoja(cliente.id)])

  const cartoes = ordenarPlataformas(
    PLATAFORMAS_DE_LOJA.map((id) => ({
      ficha: FICHAS[id],
      estado: estadoDaPlataforma(FICHAS[id], id === 'magento' ? magento : null),
      pedida: pedidos.includes(id),
    })),
  )

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarLoja
        clienteId={cliente.id}
        cartoes={cartoes}
        queroEsta={acaoQueroEstaPlataforma.bind(null, cliente.id)}
        // O guia mora no repositório público, e é o que se manda ao técnico
        // da loja: ele não tem acesso ao painel.
        guiaDoMagento="https://github.com/gabrielfeelix/autofluxos/blob/main/docs/GUIA-MAGENTO-LOJISTA.md"
      />
    </ClienteShell>
  )
}
