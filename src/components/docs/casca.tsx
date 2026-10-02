import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ARTIGOS, CATEGORIAS, categoriaDe } from '@/components/ajuda/artigos'
import { FaleComAGente } from '@/components/ajuda/moldura'
import { BuscaK, type EntradaDaBusca } from './busca-k'
import { CopiarPagina } from './copiar-pagina'
import { Lateral, type GrupoDaLateral } from './lateral'
import { PAGINAS_DEV } from './paginas-dev'
import { SeloDeMetodo, type Metodo } from './referencia'
import './docs.css'

/**
 * A casca da central de ajuda e da documentação para desenvolvedores.
 *
 * Duas áreas, um desenho: o cabeçalho em vidro sobre o azul troca entre elas,
 * e o conteúdo mora num quadro branco com lateral de navegação, texto e a
 * coluna da direita (sumário nos guias, código nos endpoints).
 */

export type Area = 'ajuda' | 'dev'

function entradasDaBusca(): EntradaDaBusca[] {
  return [
    ...ARTIGOS.map((artigo) => ({
      href: `/ajuda/${artigo.id}`,
      titulo: artigo.titulo,
      grupo: categoriaDe(artigo).titulo,
      area: 'Central de ajuda',
      termos: `${artigo.resumo} ${artigo.palavras.join(' ')}`,
    })),
    ...PAGINAS_DEV.map((pagina) => ({
      href: `/ajuda/desenvolvedores/${pagina.slug}`,
      titulo: pagina.titulo,
      grupo: pagina.grupo,
      area: 'Desenvolvedores',
      termos: `${pagina.resumo} ${pagina.metodo ?? ''} api webhook`,
    })),
  ]
}

export function gruposDaAjuda(): GrupoDaLateral[] {
  return CATEGORIAS.map((categoria) => ({
    titulo: categoria.titulo,
    itens: ARTIGOS.filter((artigo) => artigo.categoria === categoria.id).map((artigo) => ({
      href: `/ajuda/${artigo.id}`,
      rotulo: artigo.titulo,
    })),
  }))
}

export function gruposDev(): GrupoDaLateral[] {
  const grupos: GrupoDaLateral[] = []
  for (const pagina of PAGINAS_DEV) {
    let grupo = grupos.find((existente) => existente.titulo === pagina.grupo)
    if (!grupo) {
      grupo = { titulo: pagina.grupo, itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push({ href: `/ajuda/desenvolvedores/${pagina.slug}`, rotulo: pagina.titulo, metodo: pagina.metodo })
  }
  return grupos
}

export function CabecalhoDeDocs({ area }: { area: Area | 'inicio' }) {
  const aba = (alvo: Area, href: string, rotulo: string) => (
    <Link
      href={href}
      aria-current={area === alvo ? 'page' : undefined}
      className={`inline-flex h-9 items-center rounded-[10px] px-2.5 text-[13.5px] md:px-3 font-medium whitespace-nowrap transition ${
        area === alvo ? 'bg-white text-[#1d4ed8] shadow-[0_4px_12px_-6px_rgb(8_20_70/0.5)]' : 'text-white/85 hover:bg-white/10 hover:text-white'
      }`}
    >
      {rotulo}
    </Link>
  )

  return (
    <header className="mx-auto w-full max-w-[1440px] px-3 pt-3 md:px-6">
      <div className="flex h-[60px] items-center gap-2 rounded-2xl border border-white/25 bg-white/[0.14] pr-2 pl-3 text-white backdrop-blur-md md:gap-4 md:pl-4">
        <Link href="/ajuda" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-white">
            <Image src="/logos/logo-autofluxos-marca.png" alt="" width={22} height={22} />
          </span>
          <span className="hidden text-[15px] font-bold tracking-[-0.01em] lg:inline">AutoFluxos</span>
        </Link>
        <nav aria-label="Áreas" className="flex items-center gap-1 overflow-x-auto">
          {aba('ajuda', '/ajuda', 'Central de ajuda')}
          {aba('dev', '/ajuda/desenvolvedores/visao-geral', 'Desenvolvedores')}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <BuscaK entradas={entradasDaBusca()} />
          <Link
            href="/painel"
            className="hidden h-10 items-center rounded-xl bg-white px-4 text-[13px] font-semibold whitespace-nowrap text-[#1d4ed8] transition hover:bg-white/90 sm:inline-flex"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </header>
  )
}

type Vizinho = { href: string; titulo: string } | undefined

export function PaginaDeDocs({
  area,
  grupos,
  ativo,
  trilha,
  titulo,
  resumo,
  metodo,
  anterior,
  proximo,
  direita,
  children,
}: {
  area: Area
  grupos: GrupoDaLateral[]
  ativo: string
  trilha: string
  titulo: string
  resumo: string
  metodo?: Metodo
  anterior: Vizinho
  proximo: Vizinho
  /** Coluna da direita. Larga quando é código. */
  direita?: { conteudo: ReactNode; larga?: boolean }
  children: ReactNode
}) {
  const colunas = direita?.larga
    ? 'lg:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_440px]'
    : 'lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_210px]'

  return (
    <div className="mx-3 mt-3 rounded-[28px] bg-panel shadow-[var(--sombra-ilha)] md:mx-6">
      <div className={`mx-auto grid max-w-[1440px] gap-x-10 px-5 md:px-8 ${colunas}`}>
        <aside className="hidden border-r border-line py-8 pr-6 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto pb-6">
            <Lateral grupos={grupos} ativo={ativo} />
          </div>
        </aside>

        <article className="min-w-0 py-8 md:py-10">
          <div className={direita?.larga ? 'max-w-[760px]' : 'mx-auto max-w-[720px]'}>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-primary">{trilha}</p>
              <CopiarPagina />
              <Seta vizinho={anterior} direcao="anterior" />
              <Seta vizinho={proximo} direcao="proximo" />
            </div>
            <h1 className="mt-2 flex flex-wrap items-center gap-3 text-[30px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-ink md:text-[34px]">
              {metodo && <SeloDeMetodo metodo={metodo} />}
              {titulo}
            </h1>
            <p className="mt-2.5 text-[16.5px] leading-[1.6] text-muted">{resumo}</p>

            <details className="mt-6 rounded-xl border border-line lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                Navegar pela documentação
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-dim"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="border-t border-line p-3">
                <Lateral grupos={grupos} ativo={ativo} />
              </div>
            </details>

            <div data-pagina className="artigo-de-ajuda mt-8 space-y-5 text-[15px] leading-[1.75] text-muted">
              {children}
            </div>

            <nav aria-label="Outras páginas" className="mt-14 flex flex-wrap justify-between gap-4 border-t border-line pt-6">
              {anterior ? (
                <Link href={anterior.href} className="group text-[14px]">
                  <span className="block text-dim">Anterior</span>
                  <span className="font-semibold text-ink group-hover:text-primary">{anterior.titulo}</span>
                </Link>
              ) : (
                <span />
              )}
              {proximo && (
                <Link href={proximo.href} className="group text-right text-[14px]">
                  <span className="block text-dim">Próximo</span>
                  <span className="font-semibold text-ink group-hover:text-primary">{proximo.titulo}</span>
                </Link>
              )}
            </nav>
            <FaleComAGente />
          </div>
        </article>

        {direita && (
          <aside className={`hidden py-10 ${direita.larga ? '2xl:block' : 'xl:block'}`}>
            <div className="sticky top-6 space-y-4">{direita.conteudo}</div>
          </aside>
        )}
      </div>
    </div>
  )
}

function Seta({ vizinho, direcao }: { vizinho: Vizinho; direcao: 'anterior' | 'proximo' }) {
  const icone = (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direcao === 'anterior' ? <path d="M19 12H5m6-6-6 6 6 6" /> : <path d="M5 12h14m-6-6 6 6-6 6" />}
    </svg>
  )
  const classe = 'flex size-8 items-center justify-center rounded-lg border border-line text-soft transition'
  if (!vizinho) return <span className={`${classe} opacity-40`}>{icone}</span>
  return (
    <Link href={vizinho.href} aria-label={`${direcao === 'anterior' ? 'Anterior' : 'Próximo'}: ${vizinho.titulo}`} className={`${classe} hover:border-primary/40 hover:text-ink`}>
      {icone}
    </Link>
  )
}
