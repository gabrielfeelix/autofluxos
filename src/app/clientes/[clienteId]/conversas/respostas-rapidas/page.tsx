import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { GerenciadorDeRespostasRapidas } from '@/components/respostas-rapidas/gerenciador'
import { acharCliente } from '@/server/repos/clientes'
import { listarRespostasRapidas } from '@/server/repos/respostas-rapidas'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, respostas] = await Promise.all([
    acharCliente(clienteId),
    listarRespostasRapidas(clienteId),
  ])
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="respostas-rapidas">
      <Miolo largura="cheia">
        <GerenciadorDeRespostasRapidas
          topo={{
            trilha: [{ rotulo: 'Conversas' }, { rotulo: 'Respostas rápidas' }],
            titulo: 'Respostas rápidas',
            descricao:
              'Frases prontas para quem atende. Elas pertencem a este cliente e aparecem na caixa de resposta do Inbox, não vão para o fluxo nem alteram o que o bot diz sozinho.',
          }}
          clienteId={cliente.id}
          inicial={respostas}
        />
      </Miolo>
    </ClienteShell>
  )
}
