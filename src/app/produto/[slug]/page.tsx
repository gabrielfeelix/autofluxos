import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { PaginaDoSite, SecaoFluxo, SecaoNaPratica } from '../../(site)/pagina-do-site'
import { RECURSOS, recursoPorSlug } from '../../(site)/recursos-do-site'
import { SecaoCalculadora, SecaoDoisLados, SecaoIaNaConversa, SecaoPrecoResumo } from '../../(site)/secoes-do-site'
import { CapaDoProduto, CorpoDoProduto, SecaoConversaPreenche, SecaoRelatoriosEmAbas } from '../../(site)/produto-pagina'
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
  'contatos-e-funil': () => <SecaoConversaPreenche />,
  transmissoes: () => <SecaoCalculadora />,
  relatorios: () => <SecaoRelatoriosEmAbas />,
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
    <PaginaDoSite cor={recurso.cor} capa={<CapaDoProduto recurso={recurso} />}>
      <CorpoDoProduto recurso={recurso}>{PECAS[recurso.slug]?.()}</CorpoDoProduto>
      <SecaoPrecoResumo />
    </PaginaDoSite>
  )
}
