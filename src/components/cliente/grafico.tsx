'use client'

import { useState } from 'react'

export type PontoDaSerie = {
  dia: string
  contatosNovos: number
  conversas: number
  foramParaPessoa: number
}

type Metrica = keyof Omit<PontoDaSerie, 'dia'>

const METRICAS: { chave: Metrica; rotulo: string; cor: string }[] = [
  { chave: 'contatosNovos', rotulo: 'Contatos novos', cor: '#8de2fa' },
  { chave: 'conversas', rotulo: 'Conversas', cor: '#a78bfa' },
  { chave: 'foramParaPessoa', rotulo: 'Foram para pessoa', cor: '#fb7185' },
]

/**
 * A série diária do painel (§3.1 do plano).
 *
 * **SVG à mão, sem biblioteca de gráfico.** São três séries de trinta pontos
 * num painel que já carrega o editor inteiro; qualquer biblioteca custaria mais
 * bytes que o resto da página e traria um tema para brigar com o nosso. O que
 * um gráfico precisa ter — eixo com escala honesta, valor ao passar o mouse,
 * dia vazio valendo zero — cabe aqui.
 *
 * **O eixo começa em zero, sempre.** Escala que começa no menor valor é como se
 * transforma uma variação de três em cinco num salto vertical — a leitura fica
 * dramática e falsa, e num relatório que vai para o cliente isso não é opção.
 */
export function GraficoDaSerie({ serie }: { serie: PontoDaSerie[] }) {
  const [metrica, setMetrica] = useState<Metrica>('contatosNovos')
  const [barras, setBarras] = useState(true)

  const escolhida = METRICAS.find((m) => m.chave === metrica)!
  const valores = serie.map((ponto) => ponto[metrica])
  const maximo = Math.max(1, ...valores)
  const total = valores.reduce((soma, valor) => soma + valor, 0)

  // Coordenadas num espaço fixo; o SVG escala sozinho com `viewBox`.
  const largura = 720
  const altura = 160
  const passo = serie.length > 1 ? largura / (serie.length - 1) : largura

  const y = (valor: number) => altura - (valor / maximo) * (altura - 12)

  const linha = serie
    .map((ponto, i) => `${i === 0 ? 'M' : 'L'} ${(i * passo).toFixed(1)} ${y(ponto[metrica]).toFixed(1)}`)
    .join(' ')

  return (
    <section className="app-card mb-[18px] overflow-hidden" aria-labelledby="titulo-serie">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2
            id="titulo-serie"
            className="text-[12px] font-bold tracking-[0.08em] text-dim uppercase"
          >
            Últimos {serie.length} dias
          </h2>
          <p className="mt-1 text-[13px] text-soft">
            <strong className="text-[17px] font-bold text-white">{total}</strong>{' '}
            {escolhida.rotulo.toLowerCase()} no período
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {METRICAS.map((m) => (
            <button
              key={m.chave}
              type="button"
              onClick={() => setMetrica(m.chave)}
              aria-pressed={metrica === m.chave}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                metrica === m.chave
                  ? 'border-accent/40 bg-accent/[0.14] text-accent'
                  : 'border-white/[0.08] text-dim hover:border-white/20 hover:text-muted'
              }`}
            >
              {m.rotulo}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBarras((estava) => !estava)}
            title={barras ? 'Ver como linha' : 'Ver como barras'}
            aria-label={barras ? 'Ver como linha' : 'Ver como barras'}
            className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] text-dim transition hover:border-white/20 hover:text-muted"
          >
            {barras ? '📈' : '📊'}
          </button>
        </div>
      </header>

      <div className="px-6 py-5">
        {total === 0 ? (
          <p className="py-8 text-center text-[12.5px] leading-5 text-dim">
            Nada neste período ainda. O gráfico aparece assim que o número
            começar a receber mensagem.
          </p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${largura} ${altura + 4}`}
              className="h-[170px] w-full overflow-visible"
              role="img"
              aria-label={`${escolhida.rotulo} por dia nos últimos ${serie.length} dias`}
            >
              {/* Duas linhas de referência: o máximo e a metade. Mais que isso
                  vira grade, e grade compete com o dado num gráfico deste
                  tamanho. */}
              {[maximo, Math.round(maximo / 2)].map((marca) => (
                <g key={marca}>
                  <line
                    x1={0}
                    x2={largura}
                    y1={y(marca)}
                    y2={y(marca)}
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 4"
                  />
                  <text x={0} y={y(marca) - 4} fill="#6b7686" fontSize={10}>
                    {marca}
                  </text>
                </g>
              ))}

              {barras
                ? serie.map((ponto, i) => {
                    const valor = ponto[metrica]
                    const largutaDaBarra = Math.max(2, passo * 0.6)
                    return (
                      <rect
                        key={ponto.dia}
                        x={i * passo - largutaDaBarra / 2}
                        y={y(valor)}
                        width={largutaDaBarra}
                        height={Math.max(valor > 0 ? 2 : 0, altura - y(valor))}
                        rx={2}
                        fill={escolhida.cor}
                        opacity={0.85}
                      >
                        <title>{`${diaLegivel(ponto.dia)}: ${valor}`}</title>
                      </rect>
                    )
                  })
                : (
                    <>
                      <path d={linha} fill="none" stroke={escolhida.cor} strokeWidth={2} />
                      {serie.map((ponto, i) => (
                        <circle
                          key={ponto.dia}
                          cx={i * passo}
                          cy={y(ponto[metrica])}
                          r={3}
                          fill={escolhida.cor}
                        >
                          <title>{`${diaLegivel(ponto.dia)}: ${ponto[metrica]}`}</title>
                        </circle>
                      ))}
                    </>
                  )}
            </svg>

            <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">
              <span>{diaLegivel(serie[0]?.dia ?? '')}</span>
              <span>{diaLegivel(serie[serie.length - 1]?.dia ?? '')}</span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * `2026-08-18` → `18/ago`.
 *
 * Recortado da string, e não por `new Date`: a data vem do banco já no dia de
 * São Paulo, e passar por `Date` a reinterpretaria em UTC — o dia 1º viraria o
 * último do mês anterior para metade do país.
 */
function diaLegivel(dia: string): string {
  const [, mes, diaDoMes] = dia.split('-')
  if (!mes || !diaDoMes) return dia
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${diaDoMes}/${meses[Number(mes) - 1] ?? mes}`
}
