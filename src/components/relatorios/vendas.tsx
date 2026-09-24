import Link from 'next/link'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'
import { diasAteFechar } from '@/core/analise-de-vendas'
import { comoDinheiro } from '@/core/crm'

/**
 * As peças de Análise > Vendas que não são gráfico: a tabela da equipe e a
 * tela vazia. Os gráficos moram em `graficos.tsx`.
 */

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
