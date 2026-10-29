import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { PaginaDoSite, SecaoFluxo, SecaoNaPratica } from '../../(site)/pagina-do-site'
import { RECURSOS, recursoPorSlug } from '../../(site)/recursos-do-site'
import {
  CapaDoRecurso,
  CorpoDoRecurso,
  SecaoCalculadora,
  SecaoDoisLados,
  SecaoIaNaConversa,
  SecaoPrecoResumo,
} from '../../(site)/secoes-do-site'
import { metadadosDoSite } from '../../(site)/metadados'

/** Uma página por parte do produto, com a peça que mostra aquela parte funcionando. */
export function generateStaticParams() {
  return RECURSOS.map((r) => ({ slug: r.slug }))
}

// Funções, não elementos: montados no carregamento, pegariam `undefined` pelo import circular entre as seções.
const PECAS: Record<string, () => ReactNode> = {
  fluxos: () => <SecaoFluxo />,
  ia: () => <SecaoIaNaConversa />,
  inbox: () => (
    <>
      <SecaoNaPratica />
      <SecaoDoisLados />
    </>
  ),
  transmissoes: () => <SecaoCalculadora />,
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const recurso = recursoPorSlug((await params).slug)
  if (!recurso) return {}
  return metadadosDoSite(`/produto/${recurso.slug}`, `${recurso.nome} | AutoFluxos`, recurso.subtitulo)
}

export default async function PaginaDoRecurso({ params }: { params: Promise<{ slug: string }> }) {
  const recurso = recursoPorSlug((await params).slug)
  if (!recurso) notFound()
  return (
    <PaginaDoSite capa={<CapaDoRecurso recurso={recurso} />}>
      <CorpoDoRecurso recurso={recurso}>{PECAS[recurso.slug]?.()}</CorpoDoRecurso>
      <SecaoPrecoResumo />
    </PaginaDoSite>
  )
}
