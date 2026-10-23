import { notFound } from 'next/navigation'
import { FormaDeCobrancaDaOrganizacao } from '@/components/admin/forma-de-cobranca'
import { PlanoDaOrganizacao } from '@/components/admin/plano-da-organizacao'
import { TesteGratis } from '@/components/admin/teste-gratis'
import { TetoDaApi } from '@/components/admin/teto-da-api'
import { PLANO_DO_TESTE } from '@/core/planos'
import { TETO_DIARIO_PADRAO, tetoConfiguradoDaApi } from '@/server/api/templates'
import { acharOrganizacao } from '@/server/repos/organizacoes'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { planosVigentes } from '@/server/repos/planos'
import { contratoDaConta, testeDaConta, usoDaOrganizacao } from '@/server/repos/plano'
import { assinaturaDaConta, cobrancaDaConta } from '@/server/repos/faturas-da-conta'

export const dynamic = 'force-dynamic'

/** Plano: o atual, o uso do mês, a troca e os pedidos desta organização. */
export default async function Plano({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharOrganizacao(id)
  if (!organizacao) notFound()
  // O uso vem junto da página para o modal de troca abrir na hora.
  const [planos, pedidos, uso, contrato, tetoDaApi, testeAte, cobranca, assinatura] = await Promise.all([
    planosVigentes(),
    pedidosDePlano({ organizacaoId: id }).catch(() => []),
    usoDaOrganizacao(id),
    contratoDaConta(id),
    tetoConfiguradoDaApi(id),
    testeDaConta(id),
    cobrancaDaConta(id),
    assinaturaDaConta(id).catch(() => null),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PlanoDaOrganizacao
        organizacaoId={id}
        atual={contrato.plano}
        descida={contrato.planoAgendado && contrato.planoAgendadoPara ? { plano: contrato.planoAgendado, para: contrato.planoAgendadoPara } : null}
        precoContratado={contrato.precoContratado}
        conversas={organizacao.conversasNoMes}
        planos={planos.filter((plano) => plano.ativo || plano.id === contrato.plano || plano.id === contrato.planoAgendado).map(({ id: planoId, nome, preco, conversas, numeros, precoExcedente, resumo, recursos }) => ({ id: planoId, nome, preco, conversas, numeros, precoExcedente, resumo, recursos }))}
        uso={uso}
        pedidos={pedidos.map(({ id: pedidoId, quando, quemPediu, de, para, situacao }) => ({ id: pedidoId, quando, quemPediu, de, para, situacao }))}
      />
      <FormaDeCobrancaDaOrganizacao organizacaoId={id} inicial={cobranca} assinaturaAtiva={Boolean(assinatura?.assinaturaRef)} />
      <TesteGratis
        organizacaoId={id}
        inicial={testeAte}
        planoDoTeste={planos.find((plano) => plano.id === PLANO_DO_TESTE)?.nome ?? 'Operação'}
      />
      <TetoDaApi organizacaoId={id} inicial={tetoDaApi} padrao={TETO_DIARIO_PADRAO} />
    </div>
  )
}
