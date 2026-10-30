import { notFound } from 'next/navigation'
import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../../(site)/imagem-de-compartilhamento'
import { recursoPorSlug } from '../../(site)/recursos-do-site'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'Dialogon: uma parte do produto'

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const recurso = recursoPorSlug((await params).slug)
  if (!recurso) notFound()
  return imagemDeCompartilhamento({ olho: `Produto · ${recurso.nome}`, titulo: recurso.titulo })
}
