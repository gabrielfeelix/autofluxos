import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
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
      <Miolo largura="cheia">
        <CabecalhoDaTela
          trilha={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Etiquetas' }]}
          titulo={<>Etiquetas</>}
          descricao={<>As etiquetas que a equipe cria e aplica, como “cliente antigo”, “orçamento enviado” ou “não insistir”. Elas
          viram filtro em Contatos: clique no número para ver quem tem cada uma. As que o sistema deduz do histórico
          (<em>abriu com mídia</em>, <em>foi para pessoa</em>, <em>não respondeu</em>) não aparecem aqui, porque mudar
          uma delas na mão faria a tela mentir na próxima mensagem.</>}
        />

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
      </Miolo>
    </ClienteShell>
  )
}
