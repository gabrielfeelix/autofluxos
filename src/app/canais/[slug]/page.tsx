import { notFound } from 'next/navigation'
import { PaginaDoSite } from '../../(site)/pagina-do-site'
import { CANAIS, canalPorSlug } from '../../(site)/canais-do-site'
import { CapaDoCanal, CorpoDoCanal, SecaoPrecoResumo } from '../../(site)/secoes-do-site'
import { DadosDaTrilha } from '../../(site)/dados-estruturados'
import { metadadosDoSite } from '../../(site)/metadados'

/** Uma página por canal: como conecta, o que funciona e os limites que o motor respeita. */
export function generateStaticParams() {
  return CANAIS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const canal = canalPorSlug((await params).slug)
  if (!canal) return {}
  return metadadosDoSite(`/canais/${canal.slug}`, `${canal.nome} no Dialogon`, canal.subtitulo)
}

export default async function PaginaDoCanal({ params }: { params: Promise<{ slug: string }> }) {
  const canal = canalPorSlug((await params).slug)
  if (!canal) notFound()
  return (
    <PaginaDoSite capa={<CapaDoCanal canal={canal} />}>
      {/* Sem item para `/canais`: a rota não tem página própria, e o Google exige URL em cada nível. */}
      <DadosDaTrilha
        itens={[
          { nome: 'Início', caminho: '/' },
          { nome: canal.nome, caminho: `/canais/${canal.slug}` },
        ]}
      />
      <CorpoDoCanal canal={canal} />
      <SecaoPrecoResumo />
    </PaginaDoSite>
  )
}
