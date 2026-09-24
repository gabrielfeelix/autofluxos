import { notFound } from 'next/navigation'
import { PlanoDaOrganizacao } from '@/components/admin/plano-da-organizacao'
import { acharOrganizacao } from '@/server/repos/organizacoes'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { planosVigentes } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

/** Plano: o atual, o uso do mês, a troca e os pedidos desta organização. */
export default async function Plano({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharOrganizacao(id)
  if (!organizacao) notFound()
  const [planos, pedidos] = await Promise.all([planosVigentes(), pedidosDePlano({ organizacaoId: id }).catch(() => [])])

  return (
    <PlanoDaOrganizacao
      organizacaoId={id}
      atual={organizacao.plano || 'essencial'}
      conversas={organizacao.conversasNoMes}
      planos={planos.filter((plano) => plano.ativo || plano.id === organizacao.plano).map(({ id: planoId, nome, preco, conversas, numeros, resumo }) => ({ id: planoId, nome, preco, conversas, numeros, resumo }))}
      pedidos={pedidos.map(({ id: pedidoId, quando, quemPediu, de, para, situacao }) => ({ id: pedidoId, quando, quemPediu, de, para, situacao }))}
    />
  )
}
