import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ARTIGOS, acharArtigo, categoriaDe } from '@/components/ajuda/artigos'
import { CORPOS } from '@/components/ajuda/corpos'
import { Sumario } from '@/components/ajuda/sumario'
import { CabecalhoDeDocs, PaginaDeDocs, gruposDaAjuda } from '@/components/docs/casca'

/** Um artigo da central de ajuda, na casca de documentação. */

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

  const posicao = ARTIGOS.indexOf(artigo)
  const vizinho = (indice: number) => {
    const outro = ARTIGOS[indice]
    return outro ? { href: `/ajuda/${outro.id}`, titulo: outro.titulo } : undefined
  }

  return (
    <>
      <CabecalhoDeDocs area="ajuda" />
      <PaginaDeDocs
        area="ajuda"
        grupos={gruposDaAjuda()}
        ativo={`/ajuda/${artigo.id}`}
        trilha={categoriaDe(artigo).titulo}
        titulo={artigo.titulo}
        resumo={artigo.resumo}
        anterior={vizinho(posicao - 1)}
        proximo={vizinho(posicao + 1)}
        direita={{ conteudo: <Sumario /> }}
      >
        <Corpo />
      </PaginaDeDocs>
    </>
  )
}
