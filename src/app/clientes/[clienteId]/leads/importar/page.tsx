import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { ImportarContatos } from '@/components/lead/importar'
import { acaoImportarContatos } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { capacidadeNaPagina } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'

export const dynamic = 'force-dynamic'

/**
 * Tela própria e não um botão na barra de Leads.
 *
 * A importação precisa explicar o formato antes e mostrar o que não entrou
 * depois, as duas coisas não cabem numa barra, e enfiá-las lá empurraria a
 * tabela para baixo em toda visita para servir a uma ação que acontece uma vez.
 * Mora **sob** Leads de propósito: item novo na navegação é o erro que o
 * concorrente comete, com 11 itens contra os nossos 5.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  // A ação recusa sem `exportar` (importar em lote é da mesma capacidade).
  if (!(await capacidadeNaPagina(clienteId, 'exportar', 'todos'))) {
    return (
      <ClienteShell cliente={cliente} ativa="leads">
        <SemAcesso clienteId={clienteId} oQue="Importar contatos" />
      </ClienteShell>
    )
  }

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <Miolo largura="leitura">
        <Link
          href={`/clientes/${clienteId}/leads`}
          className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-primary"
        >
          ← Contatos
        </Link>
        <CabecalhoDaTela
          titulo="Importar contatos"
          descricao="O WhatsApp entrega o nome que a pessoa escolheu para si, e nem sempre é o nome pelo qual o negócio a conhece. A planilha do cliente tem o nome certo; esta tela liga os dois."
        />

        <ImportarContatos acao={acaoImportarContatos.bind(null, cliente.id)} />
      </Miolo>
    </ClienteShell>
  )
}
