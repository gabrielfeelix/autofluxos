import Link from 'next/link'
import { Avatar } from '@/components/inbox/avatar'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { LinhaClicavel } from '@/components/lead/linha-clicavel'
import { comoDinheiro } from '@/core/crm'
import { CLASSE_DA_COR, estaParado, type Cartao, type Etapa } from '@/core/quadros'
import { comoDias, diasDesde, filtrarNegocios, tituloDoNegocio, type FiltroDaLista } from '@/core/negocios'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { dataCurta } from '@/lib/quando'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'

const CABECALHO = 'px-4 py-3 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap text-dim uppercase'
const FUNDO_DA_LINHA = 'hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))]'

/**
 * Negócios em lista (5.2b): o mesmo funil, uma linha por negócio.
 *
 * Servidor puro: o recorte mora no endereço (`BarraDeLista`), e cada linha
 * leva à página do negócio. O quadro é para mover; a lista é para comparar
 * valor, dono e prazo de muitos negócios de uma vez.
 */
export function ListaDeNegocios({
  clienteId,
  etapas,
  cartoes,
  equipe,
  filtro,
  parametros,
  agora,
}: {
  clienteId: string
  etapas: Etapa[]
  cartoes: Cartao[]
  equipe: { id: string; nome: string }[]
  filtro: FiltroDaLista
  parametros: Record<string, string>
  agora: number
}) {
  const ordem = new Map(etapas.map((etapa, i) => [etapa.id, i]))
  const visiveis = filtrarNegocios(cartoes, filtro).sort(
    (a, b) =>
      (ordem.get(a.colunaId) ?? 99) - (ordem.get(b.colunaId) ?? 99) ||
      Date.parse(a.entrouNaColunaEm) - Date.parse(b.entrouNaColunaEm),
  )
  const emAberto = visiveis.reduce(
    (soma, c) => soma + ((c.situacao ?? 'aberta') === 'aberta' ? (c.valor ?? 0) : 0),
    0,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
        <BarraDeLista
          base={`/clientes/${clienteId}/quadros`}
          parametros={parametros}
          busca={{ chave: 'busca', placeholder: 'Buscar negócio ou pessoa', rotulo: 'Buscar negócios' }}
          grupos={[
            { chave: 'etapa', titulo: 'Etapa', opcoes: etapas.map((e) => ({ valor: e.id, rotulo: e.nome })) },
            {
              chave: 'situacao',
              titulo: 'Situação',
              opcoes: [
                { valor: 'aberta', rotulo: 'Abertos' },
                { valor: 'ganha', rotulo: 'Ganhos' },
                { valor: 'perdida', rotulo: 'Perdidos' },
              ],
            },
            {
              chave: 'responsavel',
              titulo: 'Responsável',
              opcoes: [{ valor: 'ninguem', rotulo: 'Sem responsável' }, ...equipe.map((p) => ({ valor: p.id, rotulo: p.nome }))],
            },
            {
              chave: 'temperatura',
              titulo: 'Temperatura',
              opcoes: [
                { valor: 'quente', rotulo: 'Quente' },
                { valor: 'morno', rotulo: 'Morno' },
                { valor: 'frio', rotulo: 'Frio' },
                { valor: 'nenhuma', rotulo: 'Não avaliada' },
              ],
            },
          ]}
          resumo={visiveis.length !== cartoes.length ? `${visiveis.length} de ${cartoes.length}` : undefined}
        />
        </div>
        <p className="text-[12px] text-muted tabular-nums sm:pt-2">
          <strong className="text-soft">{visiveis.length}</strong> {visiveis.length === 1 ? 'negócio' : 'negócios'}
          {emAberto > 0 && (
            <>
              {' '}· <strong className="text-soft">{comoDinheiro(emAberto)}</strong> em aberto
            </>
          )}
        </p>
      </div>

      <div className="app-card min-h-0 flex-1 overflow-auto">
        {visiveis.length === 0 ? (
          <div className="px-5 py-16 text-center">
            {cartoes.length === 0 && (
              <div className="mb-5">
                <IlustracaoQuadros />
              </div>
            )}
            <p className="text-[12.5px] text-dim">
              {cartoes.length === 0 ? 'Nenhum negócio neste funil ainda.' : 'Nenhum negócio com esses filtros.'}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-panel">
              <tr className="border-b border-line">
                <th scope="col" className={CABECALHO}>Negócio</th>
                <th scope="col" className={CABECALHO}>Contato</th>
                <th scope="col" className={CABECALHO}>Etapa</th>
                <th scope="col" className={`${CABECALHO} text-right`}>Valor</th>
                <th scope="col" className={CABECALHO}>Responsável</th>
                <th scope="col" className={CABECALHO}>Temperatura</th>
                <th scope="col" className={CABECALHO}>Na etapa</th>
                <th scope="col" className={CABECALHO}>Previsão</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const etapa = etapas.find((e) => e.id === c.colunaId)
                const titulo = tituloDoNegocio(c)
                const href = `/clientes/${clienteId}/negocios/${c.id}`
                const aberto = (c.situacao ?? 'aberta') === 'aberta'
                const parado = aberto && estaParado(c.entrouNaColunaEm, agora, etapa?.limiteDeDias ?? null)
                const atrasada = aberto && c.previsao && Date.parse(`${c.previsao}T23:59:59`) < agora
                return (
                  <LinhaClicavel key={c.id} href={href} className={`cursor-pointer border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                    <td className="max-w-[300px] px-4 py-3">
                      <Link
                        href={href}
                        className={`block truncate text-[13px] font-semibold transition hover:text-primary ${titulo.provisorio ? 'text-dim' : ''}`}
                      >
                        {titulo.texto}
                      </Link>
                      {!aberto && (
                        <span className={`text-[11px] font-semibold ${c.situacao === 'ganha' ? 'text-ok' : 'text-perigo'}`}>
                          {c.situacao === 'ganha' ? 'ganho' : 'perdido'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar nome={c.nome} tamanho={26} />
                        <span className="min-w-0">
                          <span className="block max-w-[180px] truncate text-[12.5px] font-medium">{c.nome}</span>
                          <span className="block font-mono text-[10.5px] whitespace-nowrap text-dim">{telefoneLegivel(c.telefone)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[12.5px] whitespace-nowrap">
                        <span aria-hidden className={`size-2 rounded-full ${etapa?.cor ? CLASSE_DA_COR[etapa.cor] : 'bg-slate-400/70'}`} />
                        {etapa?.nome ?? '·'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold whitespace-nowrap tabular-nums">
                      {c.valor != null ? comoDinheiro(c.valor) : <span className="font-normal text-dim">·</span>}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-[12.5px] text-muted">
                      {c.responsavelNome ?? <span className="text-dim">Sem responsável</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.temperatura ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                            c.temperatura === 'quente'
                              ? 'bg-rose-400/15 text-rose-600'
                              : c.temperatura === 'morno'
                                ? 'bg-amber-400/15 text-amber-700'
                                : 'bg-sky-400/15 text-sky-700'
                          }`}
                        >
                          {c.temperatura}
                        </span>
                      ) : (
                        <span className="text-[12px] text-dim">·</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-[12.5px] whitespace-nowrap ${parado ? 'font-semibold text-aviso' : 'text-muted'}`}>
                      {comoDias(diasDesde(c.entrouNaColunaEm, agora))}
                    </td>
                    <td className={`px-4 py-3 text-[12.5px] whitespace-nowrap ${atrasada ? 'font-semibold text-perigo' : 'text-muted'}`}>
                      {c.previsao ? dataCurta(`${c.previsao}T12:00:00`) : <span className="text-dim">·</span>}
                    </td>
                  </LinhaClicavel>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
