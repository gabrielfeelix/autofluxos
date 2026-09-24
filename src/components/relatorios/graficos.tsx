'use client'

import { useId, useState, type ReactNode } from 'react'
import { comoDinheiro } from '@/core/crm'
import { azul, dinheiroCurto, type Fatia } from './formatos'
import { IlustracaoDeRelatorio, type DesenhoDeRelatorio } from '@/components/design/ilustracoes'

/**
 * Os gráficos dos blocos de Análise. SVG à mão, sem biblioteca: são poucas
 * formas, e cada uma precisa falar o português da tela (dica, vazio, tabela).
 *
 * Regras que valem para todos, e o porquê:
 *
 * - **o número está sempre escrito ao lado da cor.** Três cores da paleta
 *   ficam abaixo de 3:1 contra o fundo claro, e daltônico não separa fatia
 *   só pela cor;
 * - cor segue a coisa, não a posição: "WhatsApp" é verde em qualquer período;
 * - quantidade é um tom só (o azul), do claro ao escuro; categoria é a paleta
 *   de `graficos.css`, em ordem, e a sétima vira "Outros".
 */

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100)
}

// ---------------------------------------------------------------------------
// Moldura
// ---------------------------------------------------------------------------

export function CaixaDoBloco({
  titulo,
  subtitulo,
  acao,
  children,
  semPadding,
}: {
  titulo: string
  subtitulo?: ReactNode
  acao?: ReactNode
  children: ReactNode
  semPadding?: boolean
}) {
  const id = useId()
  return (
    <section className="app-card flex min-w-0 flex-col overflow-hidden" aria-labelledby={id}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4">
        <div className="min-w-0">
          <h2 id={id} className="text-[14px] font-bold text-ink">
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 text-[12px] leading-5 text-dim">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      <div className={`@container flex flex-1 flex-col ${semPadding ? 'pt-3' : 'px-5 pt-4 pb-4'}`}>{children}</div>
    </section>
  )
}

/**
 * O cartão sem dado. O desenho é a forma do gráfico que vai aparecer ali
 * (`barras` quando não se diz nada, que é o ranking, o caso mais comum).
 */
export function Vazio({ children, desenho = 'barras' }: { children: ReactNode; desenho?: DesenhoDeRelatorio }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[12.5px] leading-5 text-dim">
      <IlustracaoDeRelatorio desenho={desenho} />
      <p className="max-w-[320px]">{children}</p>
    </div>
  )
}

/** O botão de duas posições (Quantidade | Valor), igual ao seletor de medida do gráfico diário. */
export function Alternador<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { chave: T; rotulo: string }[]
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex shrink-0 gap-0.5 rounded-lg bg-surface-strong p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.chave}
          type="button"
          role="tab"
          aria-selected={o.chave === valor}
          onClick={() => aoMudar(o.chave)}
          className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap transition ${
            o.chave === valor ? 'bg-panel text-ink shadow-sm' : 'text-dim hover:text-ink'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

/**
 * A tendência muda do cartão de número. Sem eixo e sem dica de propósito: ela
 * diz só "subindo, descendo ou parado"; o valor exato está no cartão.
 */
export function Sparkline({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const id = useId()
  if (valores.length < 2) return null
  const max = Math.max(...valores, 1)
  const L = 100
  const A = 30
  const pontos = valores.map((v, i) => [(i / (valores.length - 1)) * L, A - 2 - (v / max) * (A - 6)] as const)
  const linha = pontos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      preserveAspectRatio="none"
      className="h-8 w-full overflow-visible"
      role="img"
      aria-label={rotulo}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linha} L${L},${A} L0,${A} Z`} fill={`url(#${id})`} />
      <path
        d={linha}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Rosca
// ---------------------------------------------------------------------------

export type { Fatia } from './formatos'

function arco(r1: number, r2: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${(100 + r * Math.sin(a)).toFixed(3)},${(100 - r * Math.cos(a)).toFixed(3)}`
  const grande = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r2, a0)} A${r2},${r2} 0 ${grande} 1 ${p(r2, a1)} L${p(r1, a1)} A${r1},${r1} 0 ${grande} 0 ${p(r1, a0)} Z`
}

/**
 * Parte do todo, até seis fatias. As fatias somam o total escrito no meio, e a
 * legenda ao lado tem o número e o percentual de cada uma: a rosca é o
 * desenho, a legenda é a leitura.
 */
export function Rosca({
  fatias,
  totalRotulo,
  formatar = (n: number) => n.toLocaleString('pt-BR'),
}: {
  fatias: Fatia[]
  totalRotulo: string
  formatar?: (n: number) => string
}) {
  const [foco, setFoco] = useState<string | null>(null)
  const visiveis = fatias.filter((f) => f.n > 0)
  const total = visiveis.reduce((s, f) => s + f.n, 0)
  const emFoco = visiveis.find((f) => f.chave === foco)
  const folga = visiveis.length > 1 ? 0.035 : 0

  const inicios = visiveis.map((_, i) => visiveis.slice(0, i).reduce((soma, f) => soma + f.n, 0))
  const desenhos = visiveis.map((f, i) => {
    const a0 = (inicios[i]! / total) * Math.PI * 2
    const a1 = ((inicios[i]! + f.n) / total) * Math.PI * 2
    const inteiro = a1 - a0 >= Math.PI * 2 - 0.0001
    return { f, d: inteiro ? null : arco(62, 92, a0 + folga / 2, a1 - folga / 2) }
  })

  return (
    <div className="flex flex-1 flex-col items-center gap-4 @md:flex-row @md:gap-6">
      <div className="relative size-[172px] shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="size-full"
          role="img"
          aria-label={`${totalRotulo}: ${formatar(total)}`}
          onMouseLeave={() => setFoco(null)}
        >
          <circle cx="100" cy="100" r="77" fill="none" stroke="var(--surface-strong)" strokeWidth="30" />
          {desenhos.map(({ f, d }) =>
            d === null ? (
              <circle
                key={f.chave}
                cx="100"
                cy="100"
                r="77"
                fill="none"
                stroke={f.cor}
                strokeWidth="30"
                onMouseEnter={() => setFoco(f.chave)}
              />
            ) : (
              <path
                key={f.chave}
                d={d}
                fill={f.cor}
                onMouseEnter={() => setFoco(f.chave)}
                className="cursor-default transition-opacity duration-150"
                opacity={foco === null || foco === f.chave ? 1 : 0.3}
              />
            ),
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[24px] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">
            {emFoco ? `${pct(emFoco.n, total)}%` : formatar(total)}
          </span>
          <span className="mt-1 max-w-[100px] text-[10.5px] leading-[1.25] text-dim">{emFoco ? emFoco.rotulo : totalRotulo}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-1">
        {fatias.map((f) => (
          <li
            key={f.chave}
            onMouseEnter={() => f.n > 0 && setFoco(f.chave)}
            onMouseLeave={() => setFoco(null)}
            className={`rounded-lg px-2 py-1.5 transition ${foco === f.chave ? 'bg-surface' : ''}`}
          >
            <div className="flex items-center gap-2 text-[12.5px]">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{
                  background: f.n > 0 ? f.cor : 'var(--surface-strong)',
                }}
                aria-hidden
              />
              <span className={`min-w-0 flex-1 truncate ${f.alerta && f.n > 0 ? 'font-semibold text-aviso' : 'text-soft'}`}>
                {f.rotulo}
              </span>
              <strong className="tabular-nums text-ink">{formatar(f.n)}</strong>
              <span className="w-9 text-right text-[11.5px] tabular-nums text-dim">{pct(f.n, total)}%</span>
            </div>
            {f.dica && foco === f.chave && <p className="mt-0.5 pl-[18px] text-[11px] leading-4 text-dim">{f.dica}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Funil invertido
// ---------------------------------------------------------------------------

export type DegrauDoFunil = {
  chave: string
  rotulo: string
  n: number
  taxa: number | null
  perdeuMais?: boolean
}

/**
 * O funil, largo em cima e estreito embaixo, com os números ao lado.
 *
 * **A largura tem piso.** Proporcional pura, uma etapa com 1 de 30 vira um
 * fio, e um funil com etapas zeradas vira um coador de café: a forma some e
 * sobra agulha. Aqui a largura vai de 38% (ninguém) a 100% (todo mundo que
 * entrou): a ordem entre as etapas continua certa, e o número exato está
 * escrito ao lado, que é onde se lê. Etapa zerada fica cinza, no piso, como
 * lugar vazio, e não some.
 *
 * Cada fatia desce até a largura da seguinte, então a forma já mostra onde
 * afunila. Tom único do escuro ao claro, porque as etapas têm ordem. A
 * passagem que mais perde ganha um selo, e não só cor.
 */
export function FunilInvertido({ degraus }: { degraus: DegrauDoFunil[] }) {
  const [foco, setFoco] = useState<number | null>(null)
  const topo = Math.max(degraus[0]?.n ?? 0, 1)
  const PISO = 38
  // Cada etapa desce um pouco mesmo sem perda: quatro etapas com 1 negócio
  // cada ainda parecem funil, e não uma pilha de tijolos.
  const largura = (n: number, i: number) => (PISO + (100 - PISO) * Math.min(n / topo, 1)) * (1 - 0.07 * i)
  const passo = degraus.length > 1 ? 48 / (degraus.length - 1) : 0
  const topoReal = degraus[0]?.n ?? 0
  const ultimo = degraus[degraus.length - 1]?.n ?? 0

  return (
    <div className="flex flex-1 flex-col">
      <ol className="flex flex-col gap-1" onMouseLeave={() => setFoco(null)}>
        {degraus.map((d, i) => {
          const cima = largura(d.n, i)
          const baixo = i < degraus.length - 1 ? largura(degraus[i + 1]!.n, i + 1) : cima * 0.84
          const vazio = d.n === 0
          const cor = vazio ? 'var(--surface-strong)' : azul(100 - passo * i)
          const textoClaro = !vazio && 100 - passo * i > 70
          const apagada = foco !== null && foco !== i
          return (
            <li
              key={d.chave}
              onMouseEnter={() => setFoco(i)}
              className="grid cursor-default grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-3"
            >
              <div
                className={`relative h-12 transition-[opacity,transform] duration-150 ${apagada ? 'opacity-40' : ''} ${
                  foco === i ? 'scale-[1.025]' : ''
                }`}
              >
                <svg
                  viewBox="0 0 100 48"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full overflow-visible"
                  aria-hidden
                >
                  {/* O traço da mesma cor, com junta redonda, arredonda os cantos da fatia. */}
                  <path
                    d={`M${50 - cima / 2 + 2},3 L${50 + cima / 2 - 2},3 L${50 + baixo / 2 - 2},45 L${50 - baixo / 2 + 2},45 Z`}
                    fill={cor}
                    stroke={cor}
                    strokeWidth="7"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-[14px] font-bold tabular-nums ${
                    vazio ? 'text-dim' : textoClaro ? 'text-white' : 'text-ink'
                  }`}
                >
                  {d.n.toLocaleString('pt-BR')}
                </span>
              </div>
              <div
                className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-colors duration-150 ${
                  foco === i ? 'border-primary/25 bg-primary-weak' : 'border-transparent'
                }`}
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: vazio ? 'var(--line-strong)' : cor }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-semibold transition-colors ${foco === i ? 'text-primary' : 'text-ink'}`}
                    title={d.rotulo}
                  >
                    {d.rotulo}
                  </p>
                  <p
                    className={`mt-px truncate text-[11.5px] tabular-nums ${d.perdeuMais ? 'font-semibold text-aviso' : 'text-dim'}`}
                  >
                    {d.n.toLocaleString('pt-BR')} {d.n === 1 ? 'negócio' : 'negócios'}
                    {d.perdeuMais && ' · maior perda'}
                  </p>
                </div>
                <span
                  title={i === 0 ? 'Todos os negócios criados no período' : 'Quantos da etapa anterior chegaram aqui'}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums ${
                    i === 0
                      ? 'bg-surface-strong text-soft'
                      : d.taxa === null
                        ? 'bg-surface text-dim'
                        : d.perdeuMais
                          ? 'bg-aviso/12 text-aviso'
                          : 'bg-surface-strong text-soft'
                  }`}
                >
                  {i === 0 ? (
                    '100%'
                  ) : d.taxa === null ? (
                    '-'
                  ) : (
                    <>
                      <span aria-hidden>↓</span> {d.taxa}%
                    </>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      {degraus.length > 1 && (
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-3.5">
          <div>
            <p className="text-[11px] font-semibold text-dim">Da primeira à última etapa</p>
            <p className="mt-0.5 text-[12.5px] text-soft">
              <strong className="tabular-nums text-ink">{ultimo.toLocaleString('pt-BR')}</strong> de{' '}
              {topoReal.toLocaleString('pt-BR')} chegaram ao fim
            </p>
          </div>
          <p className="text-[26px] leading-none font-bold tracking-[-0.02em] tabular-nums text-ink">{pct(ultimo, topoReal)}%</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras horizontais, ranking incluído
// ---------------------------------------------------------------------------

export type LinhaDeBarra = {
  chave: string
  rotulo: string
  n: number
  /** `null` quando nada tinha valor; ausente quando a linha não tem valor. */
  valor?: number | null
  detalhe?: string
  apagada?: boolean
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

/**
 * Lista com barra proporcional, e o número escrito. Com `valorPermitido`, um
 * alternador troca Quantidade por Valor e **reordena**: o ranking de quem
 * vende mais peças não é o de quem traz mais dinheiro.
 *
 * `ranking` põe posição e iniciais, e o primeiro ganha a cor cheia: é a
 * pergunta "quem lidera", e o resto é régua.
 */
export function ListaEmBarras({
  linhas,
  unidade,
  valorPermitido = false,
  ranking = false,
  maximo = 8,
  rotuloQuantidade = 'Quantidade',
  rotuloValor = 'Valor (R$)',
  valorEmDinheiro = true,
  manterOrdem = false,
  titulo,
  subtitulo,
  vazio,
}: {
  linhas: LinhaDeBarra[]
  unidade: [singular: string, plural: string]
  valorPermitido?: boolean
  ranking?: boolean
  maximo?: number
  rotuloQuantidade?: string
  /** A segunda medida do alternador. Por padrão é dinheiro; pode ser outra contagem. */
  rotuloValor?: string
  valorEmDinheiro?: boolean
  /** Faixas com ordem própria (tempo de espera) não se reordenam pelo tamanho. */
  manterOrdem?: boolean
  titulo: string
  subtitulo?: ReactNode
  vazio: ReactNode
}) {
  const temValor = valorPermitido && linhas.some((l) => (l.valor ?? 0) > 0)
  const [medida, setMedida] = useState<'n' | 'valor'>('n')
  const [todas, setTodas] = useState(false)
  const emValor = temValor && medida === 'valor'
  const de = (l: LinhaDeBarra) => (emValor ? (l.valor ?? 0) : l.n)
  const ordenadas = manterOrdem ? linhas : [...linhas].sort((a, b) => Number(!!a.apagada) - Number(!!b.apagada) || de(b) - de(a))
  const escrever = (v: number | null | undefined) =>
    v === null || v === undefined ? '-' : valorEmDinheiro ? dinheiroCurto(v) : v.toLocaleString('pt-BR')
  const mostradas = todas ? ordenadas : ordenadas.slice(0, maximo)
  const maior = Math.max(...ordenadas.map(de), 1)
  const soma = ordenadas.reduce((s, l) => s + de(l), 0)

  return (
    <CaixaDoBloco
      titulo={titulo}
      subtitulo={subtitulo}
      acao={
        temValor ? (
          <Alternador
            rotulo={`Medida de ${titulo}`}
            opcoes={[
              { chave: 'n', rotulo: rotuloQuantidade },
              { chave: 'valor', rotulo: rotuloValor },
            ]}
            valor={medida}
            aoMudar={setMedida}
          />
        ) : undefined
      }
    >
      {linhas.length === 0 ? (
        <Vazio>{vazio}</Vazio>
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {mostradas.map((l, i) => {
              const v = de(l)
              const lider = ranking && i === 0 && !l.apagada && v > 0
              return (
                <li key={l.chave} className="flex items-center gap-3">
                  {ranking && (
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        lider ? 'bg-primary text-primary-ink' : l.apagada ? 'bg-surface text-dim' : 'bg-primary-weak text-primary'
                      }`}
                      aria-hidden
                    >
                      {l.apagada ? '?' : iniciais(l.rotulo)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-[12.5px]">
                      {ranking && <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-dim">{i + 1}º</span>}
                      <span className={`min-w-0 flex-1 truncate ${l.apagada ? 'text-dim italic' : 'font-semibold text-soft'}`}>
                        {l.rotulo}
                      </span>
                      <strong className="shrink-0 tabular-nums text-ink">
                        {emValor ? escrever(l.valor) : v.toLocaleString('pt-BR')}
                      </strong>
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-dim">{pct(v, soma)}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-surface-strong" aria-hidden>
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: v === 0 ? 0 : `max(${(v / maior) * 100}%, 6px)`,
                          background: l.apagada ? 'var(--line-strong)' : ranking && !lider ? azul(55) : 'var(--primary)',
                        }}
                      />
                    </div>
                    {l.detalhe && <p className="mt-1 truncate text-[11px] text-dim">{l.detalhe}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
          {ordenadas.length > maximo && (
            <button
              type="button"
              onClick={() => setTodas((t) => !t)}
              className="mt-3 self-start text-[12px] font-semibold text-primary hover:underline"
            >
              {todas ? 'Mostrar menos' : `Ver todos (${ordenadas.length})`}
            </button>
          )}
          <p className="mt-auto pt-3 text-[11px] text-dim">
            {emValor && valorEmDinheiro
              ? `${comoDinheiro(soma)} no total`
              : emValor
                ? `${soma.toLocaleString('pt-BR')} ${rotuloValor.toLowerCase()} no total`
                : `${soma.toLocaleString('pt-BR')} ${soma === 1 ? unidade[0] : unidade[1]} no total`}
          </p>
        </>
      )}
    </CaixaDoBloco>
  )
}

// ---------------------------------------------------------------------------
// Mapa de horários
// ---------------------------------------------------------------------------

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const DIAS_LONGOS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

/**
 * Dia da semana por hora, num tom só: mais escuro, mais conversa. Responde
 * "quando preciso de gente olhando o Inbox". `celulas[dia][hora]`, com a
 * segunda-feira na linha 0.
 */
export function MapaDeHorarios({ celulas, unidade }: { celulas: number[][]; unidade: [string, string] }) {
  const [foco, setFoco] = useState<[number, number] | null>(null)
  const maximo = Math.max(...celulas.flat(), 0)
  const total = celulas.flat().reduce((s, n) => s + n, 0)
  let pico: [number, number] = [0, 0]
  celulas.forEach((linha, d) =>
    linha.forEach((n, h) => {
      if (n > celulas[pico[0]]![pico[1]]!) pico = [d, h]
    }),
  )
  const porDia = celulas.map((l) => l.reduce((s, n) => s + n, 0))
  const diaForte = porDia.indexOf(Math.max(...porDia))
  const [fd, fh] = foco ?? pico
  const nFoco = celulas[fd]?.[fh] ?? 0

  if (total === 0) return <Vazio desenho="horarios">Nenhuma conversa começou neste período.</Vazio>

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        <p className="text-dim">
          Pico:{' '}
          <strong className="font-semibold text-ink">
            {DIAS_LONGOS[pico[0]]} às {pico[1]}h
          </strong>
        </p>
        <p className="text-dim">
          Dia mais movimentado: <strong className="font-semibold text-ink">{DIAS_LONGOS[diaForte]}</strong> (
          {pct(porDia[diaForte] ?? 0, total)}%)
        </p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[520px]" onMouseLeave={() => setFoco(null)}>
          {celulas.map((linha, d) => (
            <div key={d} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-[10.5px] font-semibold text-dim">{DIAS[d]}</span>
              <div className="grid flex-1 grid-cols-24 gap-[3px] py-[1.5px]">
                {linha.map((n, h) => (
                  <div
                    key={h}
                    onMouseEnter={() => setFoco([d, h])}
                    className={`aspect-square max-h-6 w-full rounded-[4px] transition-shadow ${foco && fd === d && fh === h ? 'ring-2 ring-ink/70' : ''}`}
                    style={{
                      background: n === 0 ? 'var(--surface)' : azul(18 + (n / maximo) * 82),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <span className="w-7 shrink-0" />
            <div className="grid flex-1 grid-cols-24 gap-[3px] text-[10px] tabular-nums text-dim">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center">
                  {h % 3 === 0 ? `${h}h` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 text-[11.5px]">
        <p className="text-soft" aria-live="polite">
          <span className="text-dim">
            {DIAS_LONGOS[fd]}, {fh}h às {fh + 1}h:
          </span>{' '}
          <strong className="tabular-nums text-ink">{nFoco}</strong> {nFoco === 1 ? unidade[0] : unidade[1]}
        </p>
        <div className="flex items-center gap-1.5 text-[10.5px] text-dim" aria-hidden>
          menos
          {[18, 40, 62, 84, 100].map((p) => (
            <span key={p} className="size-3 rounded-[3px]" style={{ background: azul(p) }} />
          ))}
          mais
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Satisfação
// ---------------------------------------------------------------------------

/**
 * O NPS num meio círculo de -100 a 100, com o arco saindo do zero para o lado
 * do resultado, e embaixo quem deu cada nota. Promotor e detrator são polos
 * opostos (azul e laranja); neutro é cinza, porque não puxa para lado nenhum.
 */
export function Satisfacao({ nps, media, porNota }: { nps: number | null; media: number | null; porNota: number[] }) {
  const [foco, setFoco] = useState<number | null>(null)
  const respostas = porNota.reduce((s, n) => s + n, 0)
  if (nps === null || respostas === 0) return <Vazio desenho="nps">Ninguém respondeu a pesquisa de satisfação neste período.</Vazio>

  const detratores = porNota.slice(0, 7).reduce((s, n) => s + n, 0)
  const neutros = (porNota[7] ?? 0) + (porNota[8] ?? 0)
  const promotores = (porNota[9] ?? 0) + (porNota[10] ?? 0)
  const maiorNota = Math.max(...porNota, 1)
  const corDaNota = (nota: number) => (nota >= 9 ? 'var(--polo-bom)' : nota >= 7 ? 'var(--polo-neutro)' : 'var(--polo-ruim)')

  // Meio círculo: -100 no lado esquerdo, 100 no direito, 0 no alto.
  const ponto = (v: number, r: number) => {
    const a = Math.PI * (1 - (v + 100) / 200)
    return `${(100 + r * Math.cos(a)).toFixed(2)},${(100 - r * Math.sin(a)).toFixed(2)}`
  }
  const trilho = `M${ponto(-100, 78)} A78,78 0 0 1 ${ponto(100, 78)}`
  const valorArco = `M${ponto(0, 78)} A78,78 0 0 ${nps >= 0 ? 1 : 0} ${ponto(nps, 78)}`
  const faixa = nps >= 75 ? 'excelente' : nps >= 50 ? 'muito bom' : nps >= 0 ? 'razoável' : 'crítico'

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mx-auto w-full max-w-[230px]">
        <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={`NPS ${nps}, de -100 a 100`}>
          <path d={trilho} fill="none" stroke="var(--surface-strong)" strokeWidth="16" strokeLinecap="round" />
          {nps !== 0 && (
            <path
              d={valorArco}
              fill="none"
              stroke={nps >= 0 ? 'var(--polo-bom)' : 'var(--polo-ruim)'}
              strokeWidth="16"
              strokeLinecap="round"
            />
          )}
          <line x1="100" y1="14" x2="100" y2="30" stroke="var(--panel)" strokeWidth="2.5" />
          <text x="18" y="110" textAnchor="middle" className="fill-[var(--dim)] text-[9px]">
            -100
          </text>
          <text x="182" y="110" textAnchor="middle" className="fill-[var(--dim)] text-[9px]">
            100
          </text>
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-[30px] leading-none font-bold tracking-[-0.03em] tabular-nums text-ink">{nps}</span>
          <span className="mt-1 text-[11px] text-dim">
            NPS {faixa} · média {media?.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>

      <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {[
          [detratores, 'var(--polo-ruim)'],
          [neutros, 'var(--polo-neutro)'],
          [promotores, 'var(--polo-bom)'],
        ].map(([n, cor], i) =>
          (n as number) > 0 ? <div key={i} style={{ flex: n as number, background: cor as string }} /> : null,
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
        {[
          ['Detratores', detratores, '0 a 6', 'var(--polo-ruim)'],
          ['Neutros', neutros, '7 e 8', 'var(--polo-neutro)'],
          ['Promotores', promotores, '9 e 10', 'var(--polo-bom)'],
        ].map(([rotulo, n, notas, cor]) => (
          <div key={rotulo as string} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: cor as string }} aria-hidden />
              <span className="truncate text-soft">{rotulo}</span>
            </div>
            <p className="mt-0.5 pl-3.5 tabular-nums">
              <strong className="text-ink">{n as number}</strong>{' '}
              <span className="text-dim">
                · {pct(n as number, respostas)}% · {notas}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <p className="mb-1.5 text-[11px] font-semibold text-dim">
          {foco === null
            ? `${respostas} ${respostas === 1 ? 'resposta' : 'respostas'} por nota`
            : `Nota ${foco}: ${porNota[foco]} ${porNota[foco] === 1 ? 'resposta' : 'respostas'}`}
        </p>
        <div className="flex h-12 items-end gap-[3px]" onMouseLeave={() => setFoco(null)}>
          {porNota.map((n, nota) => (
            <div key={nota} className="flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setFoco(nota)}>
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: n === 0 ? 2 : `${Math.max((n / maiorNota) * 100, 8)}%`,
                  background: n === 0 ? 'var(--surface-strong)' : corDaNota(nota),
                  opacity: foco === null || foco === nota ? 1 : 0.4,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] text-[9.5px] tabular-nums text-dim" aria-hidden>
          {porNota.map((_, nota) => (
            <span key={nota} className="flex-1 text-center">
              {nota}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
