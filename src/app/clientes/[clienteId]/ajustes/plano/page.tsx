import { notFound } from 'next/navigation'
import { EscolhaDePlano } from '@/components/cliente/escolha-de-plano'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { acaoPedirTrocaDePlano, acaoPreverTrocaDePlano } from '@/server/acoes-plano'
import { acharCliente } from '@/server/repos/clientes'
import { consumoDaConta, planoDaConta } from '@/server/repos/plano'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { planosVigentes } from '@/server/repos/planos'
import type { IdDoPlano } from '@/core/planos'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Em que plano a conta está, quanto ela já usou, e como pedir para mudar.
 *
 * Mora em Configurações, no grupo Conta, ao lado de "Dados do negócio" e
 * "Equipe", porque é onde o dono já vai mexer em conta e é onde ele vai
 * procurar.
 *
 * **O consumo vem antes da lista de planos, e não é ordem de layout.** Sem saber
 * quanto usou, "mudar de plano" é uma pergunta sem informação para responder: a
 * pessoa escolheria pelo preço, que é a única coisa que ela veria.
 *
 * Só quem administra a conta pode pedir a troca, no molde de `equipe/page.tsx`:
 * a página usa `conferirAcessoAoCliente`, que não redireciona, e passa
 * `podeMexer` adiante. A ação confere de novo do seu lado, porque prop de
 * componente não é segurança.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await conferirAcessoAoCliente(clienteId)
  const podeMexer = acesso !== null && podeAdministrarConta(acesso)

  const [plano, consumo, pedidos, planos] = await Promise.all([
    planoDaConta(clienteId),
    consumoDaConta(clienteId),
    pedidosDePlano({ organizacaoId: clienteId }).catch(() => []),
    planosVigentes(),
  ])
  // Só o pedido que a administração ainda não respondeu (A5). Atendido ou
  // recusado, some da tela; pedido para o plano que já vale também.
  const aberto = pedidos.find((pedido) => pedido.situacao === 'aberto' && pedido.para !== plano)
  const pedidoAberto = aberto ? { para: aberto.para as IdDoPlano, quando: aberto.quando, por: aberto.quemPediu } : null

  return (
    <AjustesShell cliente={cliente} ativa="plano">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Plano e consumo' },
          ]}
        />
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Plano e consumo</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Em que plano esta organização está, quanto já foi usado neste mês, e o que muda se
          você trocar.
        </p>

        <EscolhaDePlano
          atual={plano}
          consumo={consumo}
          podeMexer={podeMexer}
          pedidoAberto={pedidoAberto}
          pedirTroca={acaoPedirTrocaDePlano.bind(null, cliente.id)}
          preverTroca={acaoPreverTrocaDePlano.bind(null, cliente.id)}
          conexoesHref={`/clientes/${cliente.id}/ajustes/integracoes`}
          planos={planos.filter((p) => p.ativo || p.id === plano)}
        />
      </main>
    </AjustesShell>
  )
}
