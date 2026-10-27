import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ConectarCardapio } from '@/components/loja/conectar-cardapio'
import { acaoQueroEstaPlataforma } from '@/server/acoes-loja'
import { cardapiosDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'
import { pedidosDeCardapio } from '@/server/repos/lojas'

export const dynamic = 'force-dynamic'

/**
 * Comércio > Integrações > Cardápio e delivery. Lê só as integrações já
 * solicitadas; a ordem e as fichas são de `core/plataformas-de-cardapio.ts`.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()
  const [solicitadas, cardapios] = await Promise.all([pedidosDeCardapio(cliente.id), cardapiosDaConta(cliente.id)])
  const conectadas = cardapios.filter((c) => c.ativo && c.conexaoId).map((c) => c.plataforma)

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarCardapio
        clienteId={cliente.id}
        solicitadas={solicitadas}
        conectadas={conectadas}
        solicitar={acaoQueroEstaPlataforma.bind(null, cliente.id)}
      />
    </ClienteShell>
  )
}
