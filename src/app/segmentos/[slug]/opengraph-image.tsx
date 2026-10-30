import { notFound } from 'next/navigation'
import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../../(site)/imagem-de-compartilhamento'
import { nichoPorSlug } from '../../(site)/nichos-do-site'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'Dialogon para o seu ramo'

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const nicho = nichoPorSlug((await params).slug)
  if (!nicho) notFound()
  return imagemDeCompartilhamento({ olho: `Para ${nicho.nome.toLowerCase()}`, titulo: nicho.titulo })
}
