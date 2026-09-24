'use client'

import { useState } from 'react'
import { mesCurto, mesNoPeriodo, type MesDeVendas } from '@/core/analise-de-vendas'
import { comoDinheiro } from '@/core/crm'

/** R$ 12,4 mil no eixo: o valor exato fica na dica e na tabela. */
function dinheiroCurto(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(valor)}`
}

/** Um topo redondo acima do maior valor, para a linha de guia cair num número legível. */
function topoRedondo(maximo: number): number {
  if (maximo <= 4) return 4
  const passo = 10 ** Math.floor(Math.log10(maximo))
  for (const m of [1, 2, 2.5, 4, 5, 10]) {
    if (m * passo >= maximo) return m * passo
  }
  return 10 * passo
}

/**
 * Ganhos por mês, em barras.
 *
 * **Um ano inteiro, e o período em destaque.** Um período de 30 dias daria uma
 * barra só, que não diz se o mês foi bom. Os meses que caem no período ficam na
 * cor cheia; os de antes, esmaecidos, servem de régua. Barra, e não linha:
 * cada mês é uma soma separada, e o mês parado aparece como mês.
 *
 * Quem não vê valor (`emValor` falso) vê quantidade de ganhos: o mesmo
 * desenho, sem dinheiro em lugar nenhum, nem na dica, nem na tabela.
 */
export function GraficoMensal({
  meses,
  de,
  ate,
  emValor,
}: {
  meses: MesDeVendas[]
  de: string
  ate: string
  emValor: boolean
}) {
  const [foco, setFoco] = useState<number | null>(null)
  const medida = (m: MesDeVendas) => (emValor ? (m.valor ?? 0) : m.ganhos)
  const valores = meses.map(medida)
  const topo = topoRedondo(Math.max(...valores, 0))
  const rotuloDoEixo = (v: number) => (emValor ? dinheiroCurto(v) : String(v))
  const cruzaAno = meses[0]?.mes.slice(0, 4) !== meses[meses.length - 1]?.mes.slice(0, 4)
  const emFoco = foco === null ? null : meses[foco]
  const titulo = emValor ? 'Receita por mês' : 'Ganhos por mês'

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-mensal">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-mensal" className="text-[14px] font-bold">
          {titulo}
        </h2>
        <p className="flex items-center gap-3 text-[11.5px] text-dim">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary" aria-hidden />
            meses do período
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary/25" aria-hidden />
            meses anteriores
          </span>
        </p>
      </div>
      <p className="mt-1 text-[12px] text-dim">
        {emValor ? 'Soma do valor dos negócios ganhos' : 'Negócios ganhos'} em cada mês, pelo dia em que foram fechados.
      </p>

      <div className="relative mt-5 flex gap-3">
        <div className="flex h-[220px] w-14 shrink-0 flex-col justify-between text-right text-[10.5px] tabular-nums text-dim" aria-hidden>
          <span className="-translate-y-1/2">{rotuloDoEixo(topo)}</span>
          <span>{rotuloDoEixo(topo / 2)}</span>
          <span className="translate-y-1/2">{emValor ? 'R$ 0' : '0'}</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line-soft" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line-soft" aria-hidden />

          <div
            className="relative flex h-[220px] items-end gap-[2px] border-b border-line"
            onMouseLeave={() => setFoco(null)}
            role="img"
            aria-label={`${titulo}, de ${mesCurto(meses[0]?.mes ?? '', true)} a ${mesCurto(meses[meses.length - 1]?.mes ?? '', true)}. A tabela abaixo tem os valores.`}
          >
            {meses.map((m, i) => {
              const valor = medida(m)
              const altura = topo === 0 ? 0 : (valor / topo) * 100
              const dentro = mesNoPeriodo(m.mes, de, ate)
              return (
                // A coluna inteira é o alvo do ponteiro: mês com um ganho só
                // teria uma barra fina demais para achar.
                <div
                  key={m.mes}
                  className="flex h-full min-w-0 flex-1 items-end justify-center"
                  onMouseEnter={() => setFoco(i)}
                >
                  <div
                    className={`w-full max-w-[40px] rounded-t-[4px] transition-colors ${
                      dentro
                        ? foco === i
                          ? 'bg-primary-strong'
                          : 'bg-primary'
                        : foco === i
                          ? 'bg-primary/40'
                          : 'bg-primary/25'
                    }`}
                    style={{ height: valor === 0 ? 0 : `max(${altura}%, 3px)` }}
                  />
                </div>
              )
            })}
          </div>

          {emFoco && foco !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md"
              style={{ left: `${Math.min(Math.max(((foco + 0.5) / meses.length) * 100, 12), 88)}%` }}
            >
              <span className="text-dim">{mesCurto(emFoco.mes, true)}</span>{' '}
              {emValor && (
                <>
                  <strong className="tabular-nums text-ink">{emFoco.valor === null ? 'R$ 0,00' : comoDinheiro(emFoco.valor)}</strong>
                  <span className="text-dim"> · </span>
                </>
              )}
              <span className={emValor ? 'text-soft' : 'font-bold text-ink'}>
                {emFoco.ganhos} {emFoco.ganhos === 1 ? 'ganho' : 'ganhos'}
              </span>
            </div>
          )}

          <div className="mt-1.5 flex gap-[2px] text-[10.5px] tabular-nums text-dim" aria-hidden>
            {meses.map((m, i) => (
              <span key={m.mes} className={`min-w-0 flex-1 text-center ${i % 2 === 1 ? 'max-sm:invisible' : ''}`}>
                {mesCurto(m.mes, cruzaAno && (i === 0 || m.mes.endsWith('-01')))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3 text-[12px]">
        <summary className="cursor-pointer font-semibold text-primary">Ver em tabela</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface-strong text-dim">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Mês</th>
                <th className="px-3 py-1.5 text-right font-semibold">Ganhos</th>
                {emValor && <th className="px-3 py-1.5 text-right font-semibold">Valor</th>}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-t border-line-soft">
                  <td className="px-3 py-1 text-soft">
                    {mesCurto(m.mes, true)}
                    {mesNoPeriodo(m.mes, de, ate) && <span className="ml-1.5 text-dim">(no período)</span>}
                  </td>
                  <td className="px-3 py-1 text-right">{m.ganhos}</td>
                  {emValor && <td className="px-3 py-1 text-right">{m.valor === null ? '-' : comoDinheiro(m.valor)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
