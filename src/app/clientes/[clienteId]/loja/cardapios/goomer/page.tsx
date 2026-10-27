import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ConectarGoomer } from '@/components/loja/conectar-goomer'
import { capacidadeNaPagina } from '@/server/permissoes'
import { cardapioDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/** Integrações > Cardápio e delivery > Goomer. As chaves são de quem configura a operação. */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Goomer" />
      </ClienteShell>
    )
  }

  const cardapio = await cardapioDaConta(clienteId, 'goomer')
  const ligado = cardapio?.ativo && cardapio.conexaoId ? cardapio : null

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarGoomer
        clienteId={clienteId}
        conectado={
          ligado ? { clientId: ligado.idNaPlataforma ?? '', avisarCliente: ligado.avisarCliente, ultimaLeitura: ligado.pedidosLidosAte } : null
        }
      />
    </ClienteShell>
  )
}
