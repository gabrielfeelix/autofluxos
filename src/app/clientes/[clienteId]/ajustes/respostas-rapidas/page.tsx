import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { GerenciadorDeRespostasRapidas } from '@/components/respostas-rapidas/gerenciador'
import { acaoApagarRespostaRapida, acaoCriarRespostaRapida } from '@/server/acoes'
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
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[820px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={`/clientes/${clienteId}/ajustes`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
          ← Ajustes
        </Link>
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Respostas rápidas</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Frases prontas para quem atende. Elas pertencem a este cliente e aparecem na caixa de
          resposta do Inbox — não vão para o fluxo nem alteram o que o bot diz sozinho.
        </p>

        <GerenciadorDeRespostasRapidas
          respostas={respostas}
          criar={acaoCriarRespostaRapida.bind(null, cliente.id)}
          apagar={acaoApagarRespostaRapida.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}
