import Link from 'next/link'
import { iniciais as iniciaisDoNome } from '@/core/iniciais'
import type { ReactNode } from 'react'
import { Esqueleto, EsqueletoDeBusca, TopoCarregando } from '@/components/design/esqueleto'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'

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
      <CabecalhoDaTela titulo={titulo} descricao={descricao} acoes={acoes} />
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

// A tabela mora em `design/tabela.tsx`; o nome antigo continua valendo aqui.
export { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Tabela, Th, ThOrdenavel } from '@/components/design/tabela'

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
  const iniciais = iniciaisDoNome(nome)
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

/**
 * O esqueleto de uma tela de lista do admin: o topo de verdade (título,
 * descrição e o osso dos botões), a barra de busca com o texto de exemplo,
 * os números quando a tela tem, e a tabela. A descrição era osso, e piscava
 * ao trocar pelo texto que nunca dependeu de consulta (02/out/2026).
 */
export function EsqueletoDeTabela({
  titulo,
  descricao,
  acoes = [],
  busca,
  colunas = 5,
  linhas = 8,
  numeros = 0,
}: {
  titulo: string
  descricao: string
  /** Larguras dos botões do topo. */
  acoes?: string[]
  /** O texto de exemplo da busca; sem ele, a tela não tem barra. */
  busca?: string
  colunas?: number
  linhas?: number
  /** Quantos cartões de número vêm antes da tabela. */
  numeros?: number
}) {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <TopoCarregando titulo={titulo} descricao={descricao} acoes={acoes} />
      {numeros > 0 && (
        <div className={`mb-5 grid grid-cols-2 gap-3 ${numeros === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {Array.from({ length: numeros }, (_, i) => (
            <div key={i} className="app-card flex flex-col gap-2.5 px-4 py-3.5">
              <Esqueleto className="h-2.5 w-24" />
              <Esqueleto className="h-6 w-16" />
            </div>
          ))}
        </div>
      )}
      {busca && <EsqueletoDeBusca placeholder={busca} filtros />}
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
