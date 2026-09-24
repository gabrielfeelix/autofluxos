import { BarraDeLista } from '@/components/design/barra-de-lista'
import { lerParametros, SemResultado, TelaDaAdministracao } from '@/components/admin/partes'
import { TabelaDePedidos } from '@/components/admin/tabela-de-pedidos'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { planosVigentes } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

const BASE = '/admin/pedidos'

/**
 * Pedidos de troca de plano, lidos da auditoria (`pediu_troca_de_plano`), sem
 * tabela nova. Atender troca o plano da organização e registra os dois atos.
 */
export default async function Pedidos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const [todos, planos] = await Promise.all([pedidosDePlano(), planosVigentes()])
  const situacao = parametros.situacao ?? ''
  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const lista = todos
    .filter((pedido) => (situacao ? pedido.situacao === situacao : true))
    .filter((pedido) => !busca || [pedido.organizacaoNome, pedido.quemPediu].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca)))
    // Os abertos primeiro: é a fila de trabalho desta tela.
    .sort((a, b) => Number(b.situacao === 'aberto') - Number(a.situacao === 'aberto') || Date.parse(b.quando) - Date.parse(a.quando))
  const abertos = todos.filter((pedido) => pedido.situacao === 'aberto').length
  const temFiltro = !!(parametros.busca || parametros.situacao)

  return (
    <TelaDaAdministracao titulo="Pedidos de plano" descricao="As trocas de plano que as organizações pediram em Configurações > Plano. Atender troca o plano na hora; recusar só fecha o pedido.">
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: nome da organização ou e-mail', rotulo: 'Buscar pedido' }}
          grupos={[{ chave: 'situacao', titulo: 'Situação', opcoes: [{ valor: 'aberto', rotulo: 'Esperando resposta' }, { valor: 'atendido', rotulo: 'Atendidos' }, { valor: 'recusado', rotulo: 'Recusados' }] }]}
          resumo={temFiltro ? `${lista.length} de ${todos.length}` : `${todos.length} ${todos.length === 1 ? 'pedido' : 'pedidos'} · ${abertos} esperando`}
        />
      </div>
      {lista.length === 0 ? (
        <SemResultado titulo={temFiltro ? 'Nenhum pedido com estes filtros' : 'Nenhuma organização pediu troca de plano ainda'} limpar={temFiltro ? BASE : undefined} />
      ) : (
        <TabelaDePedidos
          key={JSON.stringify(parametros)}
          nomes={Object.fromEntries(planos.map((plano) => [plano.id, plano.nome]))}
          pedidos={lista.map(({ id, quando, organizacaoId, organizacaoNome, quemPediu, de, para, situacao: estado, respondidoPor }) => ({ id, quando, organizacaoId, organizacaoNome, quemPediu, de, para, situacao: estado, respondidoPor }))}
        />
      )}
    </TelaDaAdministracao>
  )
}
