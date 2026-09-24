import { notFound } from 'next/navigation'
import { ZonaDePerigo } from '@/components/admin/zona-de-perigo'
import { acharOrganizacao } from '@/server/repos/organizacoes'

export const dynamic = 'force-dynamic'

export default async function Perigo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharOrganizacao(id)
  if (!organizacao) notFound()
  return <ZonaDePerigo organizacao={{ id: organizacao.id, nome: organizacao.nome, suspensaEm: organizacao.suspensaEm }} pessoas={organizacao.pessoas} />
}
