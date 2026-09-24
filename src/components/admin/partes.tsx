import Link from 'next/link'
import type { ReactNode } from 'react'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { Esqueleto } from '@/components/design/esqueleto'
import { enderecoDaLista } from '@/core/lista-de-fluxos'

/**
 * As peças que toda tela da administração usa: a moldura do miolo, o número
 * do topo, a tabela e os esqueletos no formato de cada uma.
 *
 * A tabela é a mesma de Contatos (`app/clientes/[clienteId]/leads`): cartão
 * que cresce até o fim da página, rolagem de dentro, cabeçalho em versalete,
 * primeira coluna presa quando rola de lado, e o mesmo fundo de linha. Quem
 * passa do app da organização para a administração não troca de produto.
 */

export function TelaDaAdministracao({
  titulo,
  descricao,
  acoes,
  antes,
  children,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
  /** Acima do título: trilha de volta, no detalhe. */
  antes?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      {antes}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">{titulo}</h1>
          {descricao && <p className="mt-1 max-w-[720px] text-[13px] leading-6 text-muted">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </main>
  )
}

export function Numero({
  rotulo,
  valor,
  detalhe,
  tom = 'normal',
  href,
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: ReactNode
  tom?: 'normal' | 'aviso' | 'perigo' | 'ok'
  href?: string
}) {
  const cor = { normal: 'text-ink', aviso: 'text-aviso', perigo: 'text-perigo', ok: 'text-ok' }[tom]
  const conteudo = (
    <>
      <p className="text-[11.5px] font-semibold text-dim">{rotulo}</p>
      <p className={`mt-1 text-[24px] font-bold tracking-[-0.02em] tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.45] text-muted md:truncate">{detalhe}</p>}
    </>
  )
  return href ? (
    <Link href={href} className="app-card app-card-interactive block px-4 py-3.5">
      {conteudo}
    </Link>
  ) : (
    <div className="app-card px-4 py-3.5">{conteudo}</div>
  )
}

export const CLASSE_DO_CABECALHO =
  'px-4 py-3 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap text-dim uppercase'

/** Mesmo fundo das linhas de Contatos, escrito por extenso (o Tailwind lê o texto). */
export const FUNDO_DA_LINHA = 'hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))]'
export const FUNDO_DA_FIXA = 'bg-panel group-hover:bg-[color-mix(in_oklab,var(--surface)_75%,var(--panel))]'
/** A primeira coluna, presa na esquerda quando a tabela rola de lado. */
export const COLUNA_FIXA =
  'sticky left-0 z-[2] min-w-[200px] max-w-[320px] group-data-[rolada=sim]/rolagem:shadow-[inset_-1px_0_0_var(--line)]'

/** O cartão da tabela: cresce até o fim da página e rola por dentro. */
export function Tabela({ largura = 760, children }: { largura?: number; children: ReactNode }) {
  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full border-collapse text-left" style={{ minWidth: largura }}>
          {children}
        </table>
      </RolagemDaTabela>
    </div>
  )
}

export function Th({ children, className = '', fixa = false }: { children?: ReactNode; className?: string; fixa?: boolean }) {
  return (
    <th scope="col" className={`${CLASSE_DO_CABECALHO} sticky top-0 z-[1] bg-panel ${fixa ? `${COLUNA_FIXA} left-0 z-[3]` : ''} ${className}`}>
      {children}
    </th>
  )
}

/**
 * O cabeçalho que ordena. É um link, não um botão: a ordem mora no endereço,
 * então voltar no navegador e mandar o link para alguém devolvem a mesma lista.
 */
export function ThOrdenavel({
  base,
  parametros,
  chave,
  children,
  fixa = false,
  className = '',
}: {
  base: string
  parametros: Record<string, string>
  chave: string
  children: ReactNode
  fixa?: boolean
  className?: string
}) {
  const ativa = parametros.ordem === chave
  const desc = ativa && parametros.direcao !== 'asc'
  const proxima = ativa ? (desc ? 'asc' : 'desc') : 'desc'
  return (
    <th
      scope="col"
      aria-sort={ativa ? (desc ? 'descending' : 'ascending') : undefined}
      className={`${CLASSE_DO_CABECALHO} sticky top-0 z-[1] bg-panel ${fixa ? `${COLUNA_FIXA} left-0 z-[3]` : ''} ${className}`}
    >
      <Link
        href={enderecoDaLista(base, { ...parametros, ordem: chave, direcao: proxima })}
        scroll={false}
        className={`inline-flex items-center gap-1 transition hover:text-ink ${ativa ? 'text-ink' : ''}`}
      >
        {children}
        <span aria-hidden className={ativa ? 'text-primary' : 'opacity-0'}>
          {desc ? '↓' : '↑'}
        </span>
      </Link>
    </th>
  )
}

/** A lista vazia por filtro: diz o que aconteceu e oferece o caminho de volta. */
export function SemResultado({ titulo, limpar }: { titulo: string; limpar?: string }) {
  return (
    <div className="app-card py-14 text-center">
      <p className="text-[13px] font-bold">{titulo}</p>
      {limpar && (
        <Link href={limpar} scroll={false} className="mt-2 inline-block text-[11.5px] font-semibold text-primary hover:underline">
          Limpar filtros
        </Link>
      )}
    </div>
  )
}

export function Selo({ children, tom = 'neutro', title }: { children: ReactNode; tom?: 'neutro' | 'destaque' | 'alerta' | 'aviso' | 'ok'; title?: string }) {
  const cores = {
    neutro: 'border-line bg-surface text-muted',
    destaque: 'border-primary/25 bg-primary-weak text-primary',
    alerta: 'border-rose-400/30 bg-rose-400/[0.1] text-perigo',
    aviso: 'border-amber-400/30 bg-amber-400/[0.1] text-aviso',
    ok: 'border-emerald-400/30 bg-emerald-400/[0.1] text-ok',
  }[tom]
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${cores}`}>
      {children}
    </span>
  )
}

/** Iniciais num círculo, para quem não tem logo nem foto. */
export function Iniciais({ nome, tamanho = 32 }: { nome: string; tamanho?: number }) {
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || '?'
  return (
    <span
      style={{ width: tamanho, height: tamanho }}
      className="flex shrink-0 items-center justify-center rounded-full border border-strong bg-surface text-[10px] font-bold text-muted"
    >
      {iniciais}
    </span>
  )
}

/** Lê os parâmetros do endereço como texto simples (o primeiro, quando repetem). */
export function lerParametros(bruto: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bruto).map(([chave, valor]) => [chave, (Array.isArray(valor) ? valor[0] : valor) ?? '']),
  )
}

/** Compara para ordenar: texto em português, números como números, nulos no fim. */
export function comparar(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' })
}

export function ordenar<T>(
  lista: T[],
  parametros: Record<string, string>,
  chaves: Record<string, (item: T) => string | number | null | undefined>,
  padrao: { ordem: string; direcao: 'asc' | 'desc' },
): T[] {
  const pedida = parametros.ordem ?? ''
  const conhecida = pedida in chaves
  const ordem = conhecida ? pedida : padrao.ordem
  const direcao = conhecida ? (parametros.direcao === 'asc' ? 'asc' : 'desc') : padrao.direcao
  const valor = chaves[ordem]!
  return [...lista].sort((x, y) => {
    const a = valor(x)
    const b = valor(y)
    // Nulo fica no fim nas duas direções: inverter o sinal jogaria o vazio pro topo.
    if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '' ? 0 : 1
    if (b === null || b === undefined || b === '') return -1
    const r = comparar(a, b)
    return direcao === 'asc' ? r : -r
  })
}

/** O esqueleto de uma tela de lista: título real, barra de filtros e a tabela. */
export function EsqueletoDeTabela({
  titulo,
  colunas = 5,
  linhas = 8,
  comNumeros = false,
  comBarra = true,
}: {
  titulo: string
  colunas?: number
  linhas?: number
  comNumeros?: boolean
  comBarra?: boolean
}) {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <header className="mb-5">
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">{titulo}</h1>
        <Esqueleto className="mt-2.5 h-3 w-72 max-w-full" />
      </header>
      {comNumeros && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="app-card flex flex-col gap-2.5 px-4 py-3.5">
              <Esqueleto className="h-2.5 w-24" />
              <Esqueleto className="h-6 w-16" />
            </div>
          ))}
        </div>
      )}
      {comBarra && (
        <div className="mb-3 flex items-center gap-2">
          <Esqueleto className="h-9 w-full rounded-[10px] sm:w-[320px]" />
          <Esqueleto className="h-9 w-24 shrink-0 rounded-[10px]" />
        </div>
      )}
      <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 items-center gap-6 border-b border-line px-4">
          {Array.from({ length: colunas }, (_, i) => (
            <Esqueleto key={i} className={`h-2.5 ${i === 0 ? 'w-32' : 'w-16'}`} />
          ))}
        </div>
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex h-[58px] items-center gap-6 border-b border-line px-4 last:border-0">
            <span className="flex w-[200px] shrink-0 items-center gap-3">
              <Esqueleto className="size-8 shrink-0 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Esqueleto className="h-3 w-[80%]" />
                <Esqueleto className="h-2 w-[50%]" />
              </span>
            </span>
            {Array.from({ length: colunas - 1 }, (_, c) => (
              <Esqueleto key={c} className={`hidden h-3 md:block ${c % 2 ? 'w-14' : 'w-20'}`} />
            ))}
          </div>
        ))}
      </div>
      <span role="status" className="sr-only">
        Carregando {titulo.toLowerCase()}…
      </span>
    </main>
  )
}
