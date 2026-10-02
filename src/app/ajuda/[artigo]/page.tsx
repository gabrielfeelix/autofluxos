import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ARTIGOS, CATEGORIAS, acharArtigo, artigosDa, categoriaDe } from '@/components/ajuda/artigos'
import { BuscaDaAjuda } from '@/components/ajuda/busca'
import { CORPOS } from '@/components/ajuda/corpos'
import { FaleComAGente, IconeDaCategoria, IconeSeta, WHATSAPP_DA_4YU } from '@/components/ajuda/moldura'
import { Sumario } from '@/components/ajuda/sumario'

/**
 * Um artigo da central. Topo no azul com a trilha, o título e a busca; o texto
 * num quadro branco com três colunas no desktop: os artigos da categoria à
 * esquerda, o texto no meio (linha de leitura curta) e o sumário à direita.
 * No fim, anterior e próximo na ordem do catálogo, os relacionados e o
 * contato.
 */

export function generateStaticParams() {
  return ARTIGOS.map((artigo) => ({ artigo: artigo.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ artigo: string }> }): Promise<Metadata> {
  const artigo = acharArtigo((await params).artigo)
  if (!artigo) return {}
  return { title: `${artigo.titulo}, Central de ajuda`, description: artigo.resumo }
}

export default async function Pagina({ params }: { params: Promise<{ artigo: string }> }) {
  const artigo = acharArtigo((await params).artigo)
  const Corpo = artigo ? CORPOS[artigo.id] : undefined
  if (!artigo || !Corpo) notFound()

  const categoria = categoriaDe(artigo)
  const daCategoria = artigosDa(categoria.id)
  const posicao = ARTIGOS.indexOf(artigo)
  const anterior = ARTIGOS[posicao - 1]
  const proximo = ARTIGOS[posicao + 1]
  const relacionados = daCategoria.filter((outro) => outro.id !== artigo.id).slice(0, 3)

  return (
    <>
      <section className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-10 md:px-9 md:pt-10 md:pb-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1.5 text-[13px] text-white/80">
              <Link href="/ajuda" className="hover:text-white hover:underline">
                Central de ajuda
              </Link>
              <span aria-hidden>
                <IconeSeta />
              </span>
              <span className="text-white">{categoria.titulo}</span>
            </nav>
            <h1 className="mt-3 text-[28px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-white md:text-[38px]">
              {artigo.titulo}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-white/85">{artigo.resumo}</p>
          </div>
          <div className="w-full lg:max-w-[340px]">
            <BuscaDaAjuda whatsapp={WHATSAPP_DA_4YU} />
          </div>
        </div>
      </section>

      <div className="mx-3 rounded-[28px] bg-panel px-5 py-9 shadow-[var(--sombra-ilha)] md:mx-6 md:px-9 md:py-12">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
          <aside className="order-2 lg:order-none">
            <div className="lg:sticky lg:top-6">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span aria-hidden className="text-primary [&_svg]:size-[18px]">
                  <IconeDaCategoria icone={categoria.icone} />
                </span>
                {categoria.titulo}
              </p>
              <ul className="mt-3 space-y-0.5">
                {daCategoria.map((outro) => (
                  <li key={outro.id}>
                    <Link
                      href={`/ajuda/${outro.id}`}
                      aria-current={outro.id === artigo.id ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2 text-[13.5px] leading-[1.4] transition ${
                        outro.id === artigo.id
                          ? 'bg-primary-weak font-semibold text-primary'
                          : 'text-muted hover:bg-surface hover:text-ink'
                      }`}
                    >
                      {outro.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink">Outras categorias</p>
              <ul className="space-y-0.5">
                {CATEGORIAS.filter((outra) => outra.id !== categoria.id).map((outra) => (
                  <li key={outra.id}>
                    <Link
                      href={`/ajuda/${artigosDa(outra.id)[0]?.id ?? ""}`}
                      className="block rounded-lg px-3 py-2 text-[13.5px] text-muted transition hover:bg-surface hover:text-ink"
                    >
                      {outra.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <article className="min-w-0">
            <div className="max-w-[720px]">
              <Corpo />

              <nav aria-label="Outros artigos" className="mt-14 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
                {anterior ? (
                  <Link
                    href={`/ajuda/${anterior.id}`}
                    className="rounded-2xl border border-line px-5 py-4 transition hover:border-primary/40"
                  >
                    <span className="block text-[12.5px] text-dim">Anterior</span>
                    <span className="mt-1 block text-[14.5px] font-semibold text-ink">{anterior.titulo}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {proximo && (
                  <Link
                    href={`/ajuda/${proximo.id}`}
                    className="rounded-2xl border border-line px-5 py-4 text-right transition hover:border-primary/40"
                  >
                    <span className="block text-[12.5px] text-dim">Próximo</span>
                    <span className="mt-1 block text-[14.5px] font-semibold text-ink">{proximo.titulo}</span>
                  </Link>
                )}
              </nav>

              {relacionados.length > 0 && (
                <section className="mt-12">
                  <h2 className="text-[18px] font-bold tracking-[-0.015em] text-ink">Artigos relacionados</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                    {relacionados.map((outro) => (
                      <li key={outro.id}>
                        <Link
                          href={`/ajuda/${outro.id}`}
                          className="flex h-full flex-col rounded-2xl border border-line bg-surface px-4 py-4 transition hover:border-primary/40 hover:bg-panel"
                        >
                          <span className="text-[14px] font-semibold leading-[1.35] text-ink">{outro.titulo}</span>
                          <span className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-muted">{outro.resumo}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <FaleComAGente />
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-6">
              <Sumario />
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
