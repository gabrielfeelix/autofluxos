import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { GerenciadorDoAcervo } from '@/components/acervo/gerenciador'
import { acaoApagarDoAcervo, acaoSubirParaAcervo } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, arquivos] = await Promise.all([acharCliente(clienteId), listarAcervo(clienteId)])
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[980px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={`/clientes/${clienteId}/ajustes`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
          ← Ajustes
        </Link>
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Acervo</h1>
        <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
          Os arquivos que o bloco de Mídia pode enviar: foto da sala, vídeo do trabalho, PDF do
          plano. Copie o endereço de um arquivo e cole no bloco.{' '}
          <strong className="font-semibold text-soft">
            Eles ficam num endereço público enquanto estiverem aqui
          </strong>{' '}
          — é o que permite o WhatsApp baixá-los para entregar. Não guarde documento pessoal de
          ninguém.
        </p>

        <GerenciadorDoAcervo
          arquivos={arquivos}
          subir={acaoSubirParaAcervo.bind(null, cliente.id)}
          apagar={acaoApagarDoAcervo.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}
