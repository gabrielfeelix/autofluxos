import { notFound } from 'next/navigation'
import { PaginaDoSite } from '../../(site)/pagina-do-site'
import { NICHOS_DO_SITE, nichoPorSlug } from '../../(site)/nichos-do-site'
import { CapaDoNicho, CorpoDoNicho, IntegracoesDoNicho, SecaoPrecoResumo } from '../../(site)/secoes-do-site'
import { metadadosDoSite } from '../../(site)/metadados'

/** Uma página por nicho, no molde do Agendor: a dor do ramo, a conversa, os modelos e o que muda no app. */
export function generateStaticParams() {
  return NICHOS_DO_SITE.map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const nicho = nichoPorSlug((await params).slug)
  if (!nicho) return {}
  return metadadosDoSite(`/segmentos/${nicho.slug}`, `AutoFluxos para ${nicho.nome.toLowerCase()}`, nicho.subtitulo)
}

export default async function PaginaDoNicho({ params }: { params: Promise<{ slug: string }> }) {
  const nicho = nichoPorSlug((await params).slug)
  if (!nicho) notFound()
  return (
    <PaginaDoSite capa={<CapaDoNicho nicho={nicho} />}>
      <CorpoDoNicho nicho={nicho} />
      <SecaoPrecoResumo />
      <IntegracoesDoNicho nicho={nicho} />
    </PaginaDoSite>
  )
}
