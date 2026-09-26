import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { TabelaDeEtiquetas } from '@/components/etiquetas/tabela-de-etiquetas'
import { acharCliente } from '@/server/repos/clientes'
import { listarEtiquetasComContagem } from '@/server/repos/etiquetas'

export const dynamic = 'force-dynamic'

/**
 * Configurações > Etiquetas: criar, renomear, juntar e apagar.
 *
 * Morou em CRM > Etiquetas (plano de navegação de 24/set, 5.4) e voltou para
 * Configurações em 26/set, decisão do Gabriel: apagar etiqueta de verdade é
 * configuração, e é assim nos outros sistemas. Na ficha do contato só se
 * coloca e tira (`SeletorDeEtiquetas`). O endereço antigo redireciona para cá.
 * A tabela e as ações moram em `TabelaDeEtiquetas`; aqui só a leitura.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, etiquetas] = await Promise.all([acharCliente(clienteId), listarEtiquetasComContagem(clienteId)])
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="etiquetas">
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha caminho={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Etiquetas' }]} />
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
