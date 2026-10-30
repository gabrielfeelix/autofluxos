import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { PaginaDoSite } from '../../(site)/pagina-do-site'
import { NICHOS_DO_SITE, nichoPorSlug } from '../../(site)/nichos-do-site'
import { CapaDoRamo, CorpoDoRamo } from '../../(site)/nicho-pagina'
import { IntegracoesDoNicho, SecaoPrecoResumo } from '../../(site)/secoes-do-site'
import { metadadosDoSite } from '../../(site)/metadados'

/** Uma página por nicho, no molde do Agendor: a dor do ramo, a conversa, os modelos e o que muda no app. */
export function generateStaticParams() {
  return NICHOS_DO_SITE.map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const nicho = nichoPorSlug((await params).slug)
  if (!nicho) return {}
  return metadadosDoSite(`/segmentos/${nicho.slug}`, `Dialogon para ${nicho.nome.toLowerCase()}`, nicho.subtitulo)
}

export default async function PaginaDoNicho({ params }: { params: Promise<{ slug: string }> }) {
  const nicho = nichoPorSlug((await params).slug)
  if (!nicho) notFound()
  return (
    <PaginaDoSite cor={nicho.cor} capa={<CapaDoRamo nicho={nicho} />}>
      {/* Os olhos, riscos e destaques do quadro branco também na cor do ramo. */}
      <div style={{ '--accent': nicho.cor } as CSSProperties}>
        <CorpoDoRamo nicho={nicho} />
        <SecaoPrecoResumo />
        <IntegracoesDoNicho nicho={nicho} />
      </div>
    </PaginaDoSite>
  )
}
