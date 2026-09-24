import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { TabelaDeEtiquetas } from '@/components/etiquetas/tabela-de-etiquetas'
import { acharCliente } from '@/server/repos/clientes'
import { listarEtiquetasComContagem } from '@/server/repos/etiquetas'

export const dynamic = 'force-dynamic'

/**
 * CRM > Etiquetas (plano de navegação e CRM, 5.4): etiqueta é a nossa "lista".
 * A tabela e as ações moram em `TabelaDeEtiquetas`; aqui só a leitura.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, etiquetas] = await Promise.all([acharCliente(clienteId), listarEtiquetasComContagem(clienteId)])
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="etiquetas">
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha caminho={[{ rotulo: 'CRM' }, { rotulo: 'Etiquetas' }]} />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Etiquetas</h1>
        <p className="mt-1.5 mb-6 max-w-[680px] text-[13px] leading-6 text-dim">
          As etiquetas que a equipe cria e aplica, como “cliente antigo”, “orçamento enviado” ou “não insistir”. Elas
          viram filtro em Contatos: clique no número para ver quem tem cada uma. As que o sistema deduz do histórico
          (<em>abriu com mídia</em>, <em>foi para pessoa</em>, <em>não respondeu</em>) não aparecem aqui, porque mudar
          uma delas na mão faria a tela mentir na próxima mensagem.
        </p>

        <TabelaDeEtiquetas
          clienteId={cliente.id}
          inicial={etiquetas.map((e) => ({
            id: e.id,
            nome: e.nome,
            cor: e.cor,
            contatos: e.contatos ?? 0,
            criadoEm: e.criadoEm ?? '',
          }))}
        />
      </main>
    </ClienteShell>
  )
}
