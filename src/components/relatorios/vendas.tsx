import Link from 'next/link'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'
import { ABAS_DE_VENDAS, diasAteFechar, maiorPerda, type AbaDeVendas, type PassagemDaEtapa } from '@/core/analise-de-vendas'
import { comoDinheiro } from '@/core/crm'

/**
 * As peças de Análise > Vendas. Sem estado: tudo chega pronto da página, e as
 * barras daqui têm o número escrito ao lado, então não pedem dica de ponteiro.
 */

export function AbasDeVendas({ ativa, endereco }: { ativa: AbaDeVendas; endereco: (aba: AbaDeVendas) => string }) {
  return (
    <nav aria-label="Vendas" className="flex gap-1 overflow-x-auto border-b border-line">
      {ABAS_DE_VENDAS.map(({ chave, rotulo }) => (
        <Link
          key={chave}
          href={endereco(chave)}
          aria-current={chave === ativa ? 'page' : undefined}
          className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap transition ${
            chave === ativa ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-soft'
          }`}
        >
          {rotulo}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Quantos negócios chegaram a cada etapa. A barra é proporcional à primeira
 * etapa, que é todo mundo; entre uma etapa e a seguinte, quantos seguiram. A
 * passagem que mais perde, em proporção, ganha cor de atenção e um rótulo, e
 * nunca só a cor.
 */
export function PassagemPorEtapa({ passagens, funil }: { passagens: PassagemDaEtapa[]; funil: string }) {
  const total = passagens[0]?.chegaram ?? 0
  const pior = maiorPerda(passagens)
  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-passagem">
      <h2 id="titulo-passagem" className="text-[14px] font-bold">
        De etapa a etapa
      </h2>
      <p className="mt-1 text-[12px] leading-5 text-dim">
        Negócios criados no período no funil <strong className="font-semibold text-soft">{funil}</strong>, e até onde
        cada um chegou.
      </p>

      {total === 0 ? (
        <p className="mt-4 text-[13px] text-dim">Nenhum negócio foi criado neste funil no período.</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {passagens.map((p, i) => {
            const largura = Math.round((p.chegaram / total) * 100)
            const perdeuAqui = i === pior
            return (
              <li key={p.etapa.id}>
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[12.5px] font-semibold text-soft sm:w-40" title={p.etapa.nome}>
                    {p.etapa.nome}
                  </span>
                  <div className="h-6 min-w-0 flex-1 rounded-[5px] bg-surface-strong" aria-hidden>
                    <div
                      className="h-full rounded-[5px] bg-primary"
                      style={{ width: p.chegaram === 0 ? 0 : `max(${largura}%, 4px)` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-ink">{p.chegaram}</span>
                </div>
                {p.seguiram !== null && (
                  <p
                    className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 py-1.5 pl-[124px] text-[11.5px] sm:pl-[172px] ${
                      perdeuAqui ? 'font-semibold text-aviso' : 'text-dim'
                    }`}
                  >
                    <span aria-hidden>↓</span>
                    {p.taxa === null
                      ? 'ninguém chegou aqui'
                      : `${p.taxa}% seguiram · ${p.chegaram - p.seguiram} ${p.chegaram - p.seguiram === 1 ? 'parou' : 'pararam'}`}
                    {perdeuAqui && (
                      <span className="rounded-full bg-aviso/12 px-2 py-px text-[10.5px] font-bold whitespace-nowrap uppercase tracking-[0.04em]">
                        maior perda
                      </span>
                    )}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export function MotivosDePerda({ motivos }: { motivos: { rotulo: string; n: number; semMotivo: boolean }[] }) {
  const total = motivos.reduce((soma, m) => soma + m.n, 0)
  const maior = Math.max(...motivos.map((m) => m.n), 0)
  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-motivos">
      <h2 id="titulo-motivos" className="text-[14px] font-bold">
        Por que perdemos
      </h2>
      <p className="mt-1 text-[12px] leading-5 text-dim">
        Motivo anotado em cada negócio perdido no período.{' '}
        {total > 0 && `${total} ${total === 1 ? 'perdido' : 'perdidos'} no total.`}
      </p>
      {total === 0 ? (
        <p className="mt-4 text-[13px] text-dim">Nenhum negócio perdido no período.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {motivos.map((m) => {
            const pct = Math.round((m.n / total) * 100)
            return (
              <li key={m.rotulo}>
                <div className="flex items-baseline gap-2 text-[12.5px]">
                  <span className={m.semMotivo ? 'text-dim italic' : 'font-semibold text-soft'}>{m.rotulo}</span>
                  <span className="ml-auto tabular-nums">
                    <strong className="text-ink">{m.n}</strong> <span className="text-[11.5px] text-dim">· {pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-strong" aria-hidden>
                  <div
                    className={`h-full rounded-full ${m.semMotivo ? 'bg-strong' : 'bg-primary'}`}
                    style={{ width: `max(${Math.round((m.n / maior) * 100)}%, 4px)` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export type LinhaDaEquipe = {
  chave: string
  nome: string
  ganhos: number
  perdidos: number
  valor: number | null
  taxa: number | null
  segundosAteGanhar: number | null
}

function comoDias(segundos: number | null): string {
  const dias = diasAteFechar(segundos)
  if (dias === null) return '-'
  if (dias === 0) return 'no mesmo dia'
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * Por responsável. Tabela no computador; no celular, um cartão por pessoa,
 * porque cinco colunas em 390px viram rolagem de lado que ninguém descobre.
 */
export function TabelaDaEquipe({ linhas, podeVerValor }: { linhas: LinhaDaEquipe[]; podeVerValor: boolean }) {
  return (
    <section className="app-card overflow-hidden" aria-labelledby="titulo-equipe">
      <div className="px-5 pt-4 pb-3">
        <h2 id="titulo-equipe" className="text-[14px] font-bold">
          Quem vende
        </h2>
        <p className="mt-1 text-[12px] leading-5 text-dim">
          Negócios fechados no período, pelo responsável de cada um. Tempo até fechar vai da criação do negócio ao ganho.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-dim">Nenhum negócio fechado no período.</p>
      ) : (
        <>
          <table className="hidden w-full text-left text-[13px] md:table">
            <thead className="border-y border-line bg-surface-strong/60 text-[11.5px] text-dim">
              <tr>
                <th className="px-5 py-2 font-semibold">Responsável</th>
                <th className="px-4 py-2 text-right font-semibold">Ganhos</th>
                {podeVerValor && <th className="px-4 py-2 text-right font-semibold">Valor ganho</th>}
                <th className="w-[28%] px-4 py-2 font-semibold">Taxa de vitória</th>
                <th className="px-5 py-2 text-right font-semibold">Tempo médio até ganhar</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-t border-line-soft first:border-t-0">
                  <td className={`px-5 py-3 font-semibold ${l.chave === 'sem' ? 'text-dim italic' : 'text-ink'}`}>{l.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <strong className="text-ink">{l.ganhos}</strong>
                    <span className="text-[11.5px] text-dim"> de {l.ganhos + l.perdidos}</span>
                  </td>
                  {podeVerValor && (
                    <td className="px-4 py-3 text-right tabular-nums text-soft">{l.valor === null ? '-' : comoDinheiro(l.valor)}</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-surface-strong" aria-hidden>
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: l.taxa ? `max(${l.taxa}%, 4px)` : 0 }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right tabular-nums font-semibold text-soft">
                        {l.taxa === null ? '-' : `${l.taxa}%`}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-soft">{comoDias(l.segundosAteGanhar)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="border-t border-line md:hidden">
            {linhas.map((l) => (
              <li key={l.chave} className="border-t border-line-soft px-5 py-3 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`truncate text-[13.5px] font-semibold ${l.chave === 'sem' ? 'text-dim italic' : 'text-ink'}`}>
                    {l.nome}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-soft">
                    {l.taxa === null ? '-' : `${l.taxa}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-strong" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: l.taxa ? `max(${l.taxa}%, 4px)` : 0 }} />
                </div>
                <p className="mt-1.5 text-[12px] tabular-nums text-dim">
                  <strong className="font-semibold text-soft">{l.ganhos}</strong> de {l.ganhos + l.perdidos} ganhos
                  {podeVerValor && l.valor !== null && <> · {comoDinheiro(l.valor)}</>} · {comoDias(l.segundosAteGanhar)} até ganhar
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Conta sem negócio nenhum: diz o que aparece aqui e dá o primeiro passo. */
export function VendasVazio({ clienteId }: { clienteId: string }) {
  return (
    <section className="app-card px-5 py-16 text-center">
      <IlustracaoQuadros />
      <p className="mt-6 text-[14px] font-semibold text-soft">Suas vendas aparecem aqui</p>
      <p className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-5 text-dim">
        Quando um negócio for marcado como ganho ou perdido, esta tela mostra quanto entrou por mês, em que etapa os
        negócios param, por que foram perdidos e quem da equipe mais fecha.
      </p>
      <Link href={`/clientes/${clienteId}/quadros`} className="app-primary-button mt-6 inline-flex h-9 items-center px-4 text-[13px]">
        Criar negócio
      </Link>
    </section>
  )
}
