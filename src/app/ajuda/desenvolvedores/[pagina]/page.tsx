import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Sumario } from '@/components/ajuda/sumario'
import { BlocoDeCodigo } from '@/components/docs/codigo'
import { CabecalhoDeDocs, PaginaDeDocs, gruposDev } from '@/components/docs/casca'
import { PAGINAS_DEV, acharPaginaDev } from '@/components/docs/paginas-dev'

/**
 * Uma página da documentação para desenvolvedores. Endpoint ganha a coluna de
 * código à direita (requisição e resposta), como nas referências de API; guia
 * ganha o sumário.
 */

export function generateStaticParams() {
  return PAGINAS_DEV.map((pagina) => ({ pagina: pagina.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const pagina = acharPaginaDev((await params).pagina)
  if (!pagina) return {}
  return { title: `${pagina.titulo}, Desenvolvedores`, description: pagina.resumo }
}

export default async function Pagina({ params }: { params: Promise<{ pagina: string }> }) {
  const pagina = acharPaginaDev((await params).pagina)
  if (!pagina) notFound()

  const posicao = PAGINAS_DEV.indexOf(pagina)
  const vizinho = (indice: number) => {
    const outra = PAGINAS_DEV[indice]
    return outra ? { href: `/ajuda/desenvolvedores/${outra.slug}`, titulo: outra.titulo } : undefined
  }
  const { Corpo } = pagina

  return (
    <>
      <CabecalhoDeDocs area="dev" />
      <PaginaDeDocs
        area="dev"
        grupos={gruposDev()}
        ativo={`/ajuda/desenvolvedores/${pagina.slug}`}
        trilha={pagina.grupo}
        titulo={pagina.titulo}
        resumo={pagina.resumo}
        metodo={pagina.metodo}
        anterior={vizinho(posicao - 1)}
        proximo={vizinho(posicao + 1)}
        direita={
          pagina.painel
            ? { larga: true, conteudo: pagina.painel.map((bloco) => <BlocoDeCodigo key={bloco.titulo} titulo={bloco.titulo} trechos={bloco.trechos} />) }
            : { conteudo: <Sumario /> }
        }
      >
        <Corpo />
        {pagina.painel && (
          <div className="space-y-4 2xl:hidden">
            {pagina.painel.map((bloco) => (
              <BlocoDeCodigo key={bloco.titulo} titulo={bloco.titulo} trechos={bloco.trechos} />
            ))}
          </div>
        )}
      </PaginaDeDocs>
    </>
  )
}
