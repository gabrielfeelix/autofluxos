'use client'

import { useState } from 'react'
import { diaCurto, type DiaDoRelatorio } from '@/core/relatorios'

type Medida = 'conversas' | 'contatosNovos' | 'foramParaPessoa'

const MEDIDAS: { chave: Medida; rotulo: string; singular: string; plural: string }[] = [
  { chave: 'conversas', rotulo: 'Conversas', singular: 'conversa', plural: 'conversas' },
  { chave: 'contatosNovos', rotulo: 'Contatos novos', singular: 'contato novo', plural: 'contatos novos' },
  { chave: 'foramParaPessoa', rotulo: 'Foram para a equipe', singular: 'foi para a equipe', plural: 'foram para a equipe' },
]

const DIA_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function diaDaSemana(dia: string): string {
  return DIA_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()] ?? ''
}

/**
 * A série diária, uma medida por vez.
 *
 * **Uma medida por vez, e não três linhas no mesmo eixo.** Contatos novos,
 * conversas e idas para a equipe têm escalas diferentes, e juntar as três
 * achataria a menor contra o chão. Trocar a medida não recarrega a página: a
 * série inteira já veio do servidor.
 *
 * Barra, e não linha: cada dia é uma contagem separada, e o dia zerado precisa
 * aparecer como dia, não como um vale que a linha atravessa. Os dias sem nada
 * chegam aqui já preenchidos (`completarDias`).
 */
export function GraficoDiario({ serie, cruzaAno }: { serie: DiaDoRelatorio[]; cruzaAno: boolean }) {
  const [medida, setMedida] = useState<Medida>('conversas')
  const [foco, setFoco] = useState<number | null>(null)
  const atual = MEDIDAS.find((m) => m.chave === medida)!

  const valores = serie.map((d) => d[medida])
  const maximo = Math.max(...valores, 0)
  // Topo redondo acima do maior valor, para a linha de guia cair num número legível.
  const topo = maximo <= 4 ? 4 : Math.ceil(maximo / 4) * 4
  const soma = valores.reduce((a, b) => a + b, 0)
  const diasZerados = valores.filter((v) => v === 0).length
  const fino = serie.length > 45

  const marcas = [0, Math.floor((serie.length - 1) / 2), serie.length - 1].filter(
    (i, pos, todas) => todas.indexOf(i) === pos,
  )
  const emFoco = foco === null ? null : serie[foco]

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-serie">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-serie" className="text-[14px] font-bold">
          {atual.rotulo} por dia
        </h2>
        <div role="tablist" aria-label="Medida do gráfico" className="flex flex-wrap gap-1 rounded-lg bg-surface-strong p-1">
          {MEDIDAS.map((m) => (
            <button
              key={m.chave}
              type="button"
              role="tab"
              aria-selected={m.chave === medida}
              onClick={() => setMedida(m.chave)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                m.chave === medida ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink'
              }`}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-[12px] text-dim" aria-live="polite">
        {soma} {soma === 1 ? atual.singular : atual.plural} no período
        {diasZerados > 0 && ` · ${diasZerados} ${diasZerados === 1 ? 'dia' : 'dias'} sem movimento`}
      </p>

      <div className="relative mt-4 flex gap-2">
        {/* Eixo vertical: só o topo e o meio, o bastante para ler a altura. */}
        <div className="flex h-[180px] w-7 shrink-0 flex-col justify-between text-right text-[10.5px] tabular-nums text-dim" aria-hidden>
          <span className="-translate-y-1/2">{topo}</span>
          <span>{topo / 2}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line-soft" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line-soft" aria-hidden />

          <div
            className={`relative flex h-[180px] items-end border-b border-line ${fino ? 'gap-px' : 'gap-[2px]'}`}
            onMouseLeave={() => setFoco(null)}
            role="img"
            aria-label={`${atual.rotulo} por dia, de ${diaCurto(serie[0]?.dia ?? "", true)} a ${diaCurto(serie[serie.length - 1]?.dia ?? "", true)}. A tabela abaixo tem os valores.`}
          >
            {serie.map((d, i) => {
              const valor = d[medida]
              const altura = topo === 0 ? 0 : (valor / topo) * 100
              return (
                // A coluna inteira é o alvo do ponteiro, não só a barra: dia com
                // 1 conversa teria uma barra de 2px impossível de achar.
                <div
                  key={d.dia}
                  className="flex h-full min-w-0 flex-1 items-end"
                  onMouseEnter={() => setFoco(i)}
                >
                  <div
                    className={`w-full ${fino ? 'rounded-t-[2px]' : 'rounded-t-[4px]'} transition-colors ${
                      foco === i ? 'bg-primary-strong' : 'bg-primary'
                    }`}
                    style={{ height: valor === 0 ? 0 : `max(${altura}%, 2px)` }}
                  />
                </div>
              )
            })}
          </div>

          {emFoco && foco !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md"
              style={{ left: `${((foco + 0.5) / serie.length) * 100}%` }}
            >
              <span className="text-dim">
                {diaDaSemana(emFoco.dia)}, {diaCurto(emFoco.dia, cruzaAno)}
              </span>{' '}
              <strong className="tabular-nums text-ink">{emFoco[medida]}</strong>{' '}
              <span className="text-soft">{emFoco[medida] === 1 ? atual.singular : atual.plural}</span>
            </div>
          )}

          <div className="relative mt-1.5 h-4 text-[10.5px] tabular-nums text-dim" aria-hidden>
            {marcas.map((i) => (
              <span
                key={i}
                className={`absolute ${i === 0 ? 'left-0' : i === serie.length - 1 ? 'right-0' : '-translate-x-1/2'}`}
                style={i !== 0 && i !== serie.length - 1 ? { left: `${((i + 0.5) / serie.length) * 100}%` } : undefined}
              >
                {diaCurto(serie[i]?.dia ?? "", cruzaAno)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3 text-[12px]">
        <summary className="cursor-pointer font-semibold text-primary">Ver em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface-strong text-dim">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Dia</th>
                {MEDIDAS.map((m) => (
                  <th key={m.chave} className="px-3 py-1.5 text-right font-semibold">
                    {m.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serie.map((d) => (
                <tr key={d.dia} className="border-t border-line-soft">
                  <td className="px-3 py-1 text-soft">
                    {diaDaSemana(d.dia)}, {diaCurto(d.dia, cruzaAno)}
                  </td>
                  {MEDIDAS.map((m) => (
                    <td key={m.chave} className="px-3 py-1 text-right">
                      {d[m.chave]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
