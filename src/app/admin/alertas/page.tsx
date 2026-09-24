import { BarraDeLista } from '@/components/design/barra-de-lista'
import { lerParametros, SemResultado, TelaDaAdministracao } from '@/components/admin/partes'
import { TabelaDeAlertas } from '@/components/admin/tabela-de-alertas'
import { listarAlertas } from '@/server/repos/alertas'
import { IlustracaoTudoCerto } from '@/components/design/ilustracoes'

export const dynamic = 'force-dynamic'

const BASE = '/admin/alertas'

/**
 * Falhas que o produto registrou sozinho: webhook que não processou, entrega
 * recusada pela Meta, credencial que o cofre não devolveu. Somem depois de
 * 90 dias. Mesma tabela e barra de filtros das outras listas.
 */
export default async function Alertas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = lerParametros(await searchParams)
  const todos = await listarAlertas({ limite: 300 })
  const ambientes = [...new Set(todos.map((alerta) => alerta.ambiente))]

  const busca = (parametros.busca ?? '').trim().toLocaleLowerCase('pt-BR')
  const lista = todos.filter((alerta) => {
    if (parametros.situacao === 'abertos' && alerta.vistoEm !== null) return false
    if (parametros.situacao === 'vistos' && alerta.vistoEm === null) return false
    if (parametros.ambiente && alerta.ambiente !== parametros.ambiente) return false
    if (busca && ![alerta.titulo, alerta.detalhe, JSON.stringify(alerta.contexto)].some((texto) => texto.toLocaleLowerCase('pt-BR').includes(busca))) return false
    return true
  })
  const temFiltro = !!(parametros.busca || parametros.situacao || parametros.ambiente)
  const abertos = todos.filter((alerta) => alerta.vistoEm === null).length

  return (
    <TelaDaAdministracao titulo="Alertas" descricao="Falhas que o produto registrou sozinho: webhook que não processou, entrega recusada pela Meta, credencial que o cofre não devolveu. Somem depois de 90 dias.">
      <div className="mb-3">
        <BarraDeLista
          base={BASE}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Exemplo: webhook, número ou mensagem de erro', rotulo: 'Buscar alerta' }}
          grupos={[
            { chave: 'situacao', titulo: 'Situação', opcoes: [{ valor: 'abertos', rotulo: 'Não vistos' }, { valor: 'vistos', rotulo: 'Vistos' }] },
            ...(ambientes.length > 1 ? [{ chave: 'ambiente', titulo: 'Ambiente', opcoes: ambientes.map((valor) => ({ valor, rotulo: valor })) }] : []),
          ]}
          resumo={temFiltro ? `${lista.length} de ${todos.length}` : `${todos.length} ${todos.length === 1 ? 'alerta' : 'alertas'} · ${abertos} não ${abertos === 1 ? 'visto' : 'vistos'}`}
        />
      </div>
      {lista.length === 0 ? (
        temFiltro ? (
          <SemResultado titulo="Nenhum alerta com estes filtros" limpar={BASE} />
        ) : (
          <section className="app-card px-8 py-12 text-center">
            <IlustracaoTudoCerto />
            <p className="mt-6 text-[14px] font-semibold text-soft">Nada quebrou</p>
            <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
              Esta tela vazia é a notícia boa. Ela enche sozinha quando o webhook do WhatsApp falhar, a Cloud API recusar uma entrega ou o cofre não devolver uma credencial.
            </p>
          </section>
        )
      ) : (
        <TabelaDeAlertas
          key={JSON.stringify(parametros)}
          alertas={lista.map((alerta) => ({
            id: alerta.id,
            titulo: alerta.titulo,
            detalhe: alerta.detalhe,
            contexto: Object.entries(alerta.contexto).map(([chave, valor]) => [chave, String(valor)] as [string, string]),
            ambiente: alerta.ambiente,
            criadoEm: alerta.criadoEm,
            visto: alerta.vistoEm !== null,
          }))}
        />
      )}
    </TelaDaAdministracao>
  )
}
