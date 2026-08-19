import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ImportarContatos } from '@/components/lead/importar'
import { acaoImportarContatos } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * Tela própria e não um botão na barra de Leads.
 *
 * A importação precisa explicar o formato antes e mostrar o que não entrou
 * depois — as duas coisas não cabem numa barra, e enfiá-las lá empurraria a
 * tabela para baixo em toda visita para servir a uma ação que acontece uma vez.
 * Mora **sob** Leads de propósito: item novo na navegação é o erro que o
 * concorrente comete, com 11 itens contra os nossos 5.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="w-full max-w-[1000px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
          href={`/clientes/${clienteId}/leads`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
        >
          ← Contatos
        </Link>
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Importar contatos</h1>
        <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
          O WhatsApp entrega o nome que a pessoa escolheu para si, e nem sempre é o nome pelo qual
          o negócio a conhece. A planilha do cliente tem o nome certo; esta tela liga os dois.
        </p>

        <ImportarContatos acao={acaoImportarContatos.bind(null, cliente.id)} />
      </main>
    </ClienteShell>
  )
}
