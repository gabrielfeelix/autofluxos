import { notFound } from 'next/navigation'
import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../../(site)/imagem-de-compartilhamento'
import { canalPorSlug } from '../../(site)/canais-do-site'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'AutoFluxos: um canal de atendimento'

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const canal = canalPorSlug((await params).slug)
  if (!canal) notFound()
  return imagemDeCompartilhamento({ olho: `Canais · ${canal.nome}`, titulo: canal.titulo })
}
