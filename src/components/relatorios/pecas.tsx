import Link from 'next/link'
import type { ReactNode } from 'react'
import { ATALHOS_DE_PERIODO, comoDuracao, diaCurto, variacao, type Periodo } from '@/core/relatorios'

/**
 * As peças que Análise > Atendimento e Análise > Vendas dividem: o período no
 * topo, o cartão de número com o "?" e as frases de comparação.
 */

/**
 * Atalhos como link e o intervalo à mão como formulário `get`: escolher o
 * período muda o endereço, então ele pode ser salvo e mandado para alguém.
 *
 * `manter` são os outros parâmetros da tela (aba, funil): trocar o período não
 * pode jogar a pessoa de volta para a primeira aba.
 */
export function BarraDoPeriodo({
  base,
  periodo,
  anterior,
  hoje,
  atalhos = ATALHOS_DE_PERIODO,
  padrao = 30,
  manter = {},
  rotuloDoAtalho = (dias: number) => `${dias} dias`,
}: {
  base: string
  periodo: Periodo
  anterior: Periodo
  hoje: string
  atalhos?: readonly number[]
  padrao?: number
  manter?: Record<string, string>
  rotuloDoAtalho?: (dias: number) => string
}) {
  const cruza = periodo.de.slice(0, 4) !== anterior.de.slice(0, 4) || periodo.de.slice(0, 4) !== hoje.slice(0, 4)
  const endereco = (extra: Record<string, string>) => {
    const busca = new URLSearchParams({ ...manter, ...extra }).toString()
    return busca ? `${base}?${busca}` : base
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Período" className="flex gap-1 rounded-lg bg-surface-strong p-1">
          {atalhos.map((dias) => (
            <Link
              key={dias}
              href={endereco(dias === padrao ? {} : { dias: String(dias) })}
              aria-current={periodo.atalho === dias ? 'page' : undefined}
              className={`rounded-md px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition ${
                periodo.atalho === dias ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink'
              }`}
            >
              {rotuloDoAtalho(dias)}
            </Link>
          ))}
        </nav>

        <details className="group relative" open={periodo.atalho === null}>
          <summary
            className={`flex cursor-pointer list-none items-center gap-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${
              periodo.atalho === null ? 'border-primary/40 bg-primary-weak text-primary' : 'border-line text-dim hover:text-ink'
            }`}
          >
            Personalizado
          </summary>
          <form action={base} method="get" className="mt-2 flex flex-wrap items-end gap-2">
            {Object.entries(manter).map(([nome, valor]) => (
              <input key={nome} type="hidden" name={nome} value={valor} />
            ))}
            <label className="flex flex-col gap-1 text-[11.5px] text-dim">
              De
              <input type="date" name="de" defaultValue={periodo.de} max={hoje} required className="app-field h-9 px-2 text-[13px]" />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-dim">
              Até
              <input type="date" name="ate" defaultValue={periodo.ate} max={hoje} required className="app-field h-9 px-2 text-[13px]" />
            </label>
            <button type="submit" className="app-primary-button h-9 px-3 text-[12.5px]">
              Aplicar
            </button>
          </form>
        </details>
      </div>

      <p className="text-[12px] text-dim">
        {diaCurto(periodo.de, cruza)} a {diaCurto(periodo.ate, cruza)} ({periodo.dias}{' '}
        {periodo.dias === 1 ? 'dia' : 'dias'}), comparado com {diaCurto(anterior.de, cruza)} a{' '}
        {diaCurto(anterior.ate, cruza)} · horário de Brasília
      </p>
    </div>
  )
}

export function Cartao({
  titulo,
  valor,
  detalhe,
  comparacao,
  definicao,
}: {
  titulo: string
  valor: string
  detalhe?: string
  comparacao?: ReactNode
  definicao: string
}) {
  return (
    <section className="app-card relative flex min-w-0 flex-col px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[12.5px] font-bold text-muted">{titulo}</h2>
        {/*
          O "?" de cada número: a definição e o fuso, a um toque. `details` e não
          `title`, porque `title` não abre no celular e é justamente onde a
          dúvida aparece.
        */}
        <details className="relative shrink-0">
          <summary
            aria-label={`O que conta em ${titulo}`}
            className="flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-strong text-[10.5px] font-bold text-dim hover:border-primary/50 hover:text-primary"
          >
            ?
          </summary>
          <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-line bg-surface p-3 text-[12px] leading-5 text-soft shadow-lg">
            {definicao}
            <span className="mt-1.5 block text-dim">Dias no horário de Brasília.</span>
          </div>
        </details>
      </div>
      <p className="mt-1.5 text-[24px] font-bold tracking-[-0.02em] tabular-nums text-ink">{valor}</p>
      {detalhe && <p className="mt-0.5 text-[11.5px] leading-5 text-dim">{detalhe}</p>}
      {comparacao && <div className="mt-auto pt-2 text-[11.5px]">{comparacao}</div>}
    </section>
  )
}

const SEM_BASE = <span className="text-dim">sem base para comparar</span>

/**
 * Volume: subir não é bom nem ruim por si, então a cor é neutra.
 * `formatar` escreve o valor anterior (dinheiro, por exemplo).
 */
export function Mudanca({
  atual,
  antes,
  formatar = String,
}: {
  atual: number | null
  antes: number | null
  formatar?: (valor: number) => string
}) {
  const v = variacao(atual, antes)
  if (v.tipo === 'sem-base' || antes === null) return SEM_BASE
  if (v.tipo === 'igual') return <span className="text-dim">igual ao período anterior ({formatar(antes)})</span>
  return (
    <span className="text-soft">
      <span aria-hidden>{v.tipo === 'subiu' ? '▲' : '▼'}</span> {v.percentual}% {v.tipo === 'subiu' ? 'a mais' : 'a menos'}{' '}
      <span className="text-dim">que o anterior ({formatar(antes)})</span>
    </span>
  )
}

/**
 * Taxa e NPS mudam em **pontos**, não em percentual: de 40% para 50% são 10
 * pontos, e escrever "+25%" faria parecer que um quarto a mais de conversas
 * foi resolvido.
 */
export function MudancaEmPontos({
  atual,
  antes,
  melhorQuando,
}: {
  atual: number | null
  antes: number | null
  melhorQuando: 'sobe' | 'desce'
}) {
  if (atual === null || antes === null) return SEM_BASE
  const diferenca = atual - antes
  if (diferenca === 0) return <span className="text-dim">igual ao período anterior</span>
  const melhorou = melhorQuando === 'sobe' ? diferenca > 0 : diferenca < 0
  return (
    <span className={melhorou ? 'text-ok' : 'text-aviso'}>
      <span aria-hidden>{diferenca > 0 ? '▲' : '▼'}</span> {Math.abs(diferenca)}{' '}
      {Math.abs(diferenca) === 1 ? 'ponto' : 'pontos'} {melhorou ? '(melhor)' : '(pior)'}{' '}
      <span className="text-dim">que o anterior</span>
    </span>
  )
}

/** Espera: descer é melhor. */
export function MudancaDeTempo({ atual, antes }: { atual: number | null; antes: number | null }) {
  const v = variacao(atual, antes)
  if (v.tipo === 'sem-base') return SEM_BASE
  if (v.tipo === 'igual') return <span className="text-dim">igual ao período anterior</span>
  const melhorou = v.tipo === 'caiu'
  return (
    <span className={melhorou ? 'text-ok' : 'text-aviso'}>
      <span aria-hidden>{v.tipo === 'subiu' ? '▲' : '▼'}</span> {v.percentual}% {melhorou ? 'mais rápida' : 'mais lenta'}{' '}
      <span className="text-dim">({comoDuracao(antes)} antes)</span>
    </span>
  )
}
