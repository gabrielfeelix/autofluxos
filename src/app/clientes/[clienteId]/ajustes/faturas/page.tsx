import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { TelaDeFaturas } from '@/components/faturas/tela-de-faturas'
import { diaDeHoje } from '@/core/contrato-do-plano'
import { valorDaAssinatura } from '@/core/mensalidade-da-4yu'
import { acaoCancelarAssinatura, acaoDetalheDaFatura } from '@/server/acoes-mensalidade-da-4yu'
import { acharCliente } from '@/server/repos/clientes'
import { assinaturaDaConta, faturasDaConta } from '@/server/repos/faturas-da-conta'
import { planoDaConta, tamanhoDaEquipe } from '@/server/repos/plano'
import { planoVigente } from '@/server/repos/planos'
import { conferirAcessoAoCliente, podeAdministrarConta } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Faturas: o que a organização pagou e o que está em aberto, com recibo e
 * nota fiscal (docs/PLANO-MENSALIDADE-ASAAS.md).
 *
 * Separada de Plano e consumo de propósito: lá a pergunta é "em que plano
 * estou e quanto usei"; aqui é "o que paguei e o que devo", e ela pede
 * tabela, filtro e exportação.
 *
 * Fatura é dado financeiro: quem não administra a organização vê o aviso, e
 * não a lista. As ações conferem de novo do lado delas.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await conferirAcessoAoCliente(clienteId)
  const podeMexer = acesso !== null && podeAdministrarConta(acesso)
  const planoHref = `/clientes/${cliente.id}/ajustes/plano`

  const cabecalho = (
    <CabecalhoDaTela
      trilha={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Faturas' }]}
      titulo={<>Faturas</>}
      descricao={<>O que esta organização pagou e o que está em aberto, com recibo e nota fiscal de cada cobrança.</>}
    />
  )

  if (!podeMexer) {
    return (
      <AjustesShell cliente={cliente} ativa="faturas">
        <Miolo largura="larga">
          {cabecalho}
          <p className="app-card p-5 text-[13px] leading-6 text-muted">
            Apenas o proprietário ou um administrador da organização vê as faturas.
          </p>
        </Miolo>
      </AjustesShell>
    )
  }

  const [assinatura, faturas, planoAtual, equipe] = await Promise.all([
    // Antes da 0147, ou com o banco fora: sem assinatura, e a tela abre igual.
    assinaturaDaConta(clienteId).catch(() => null),
    faturasDaConta(clienteId, 500),
    planoDaConta(clienteId),
    tamanhoDaEquipe(clienteId),
  ])
  const temAssinatura = Boolean(assinatura?.assinaturaRef || assinatura?.estado?.startsWith('cancelada'))
  // Enquanto aguarda, o plano é o que está sendo comprado; depois, o em vigor.
  const plano = await planoVigente(assinatura?.estado === 'aguardando' && assinatura.plano ? assinatura.plano : planoAtual)
  const ciclo = assinatura?.ciclo ?? 'mensal'

  return (
    <AjustesShell cliente={cliente} ativa="faturas">
      <Miolo largura="larga">
        {cabecalho}
        <TelaDeFaturas
          faturas={faturas}
          assinatura={
            temAssinatura
              ? { estado: assinatura!.estado, plano: plano.nome, ciclo, valorCentavos: valorDaAssinatura(plano, ciclo, equipe) }
              : null
          }
          podeMexer={podeMexer}
          planoHref={planoHref}
          csvHref={`/api/clientes/${cliente.id}/faturas/csv`}
          hoje={diaDeHoje(new Date())}
          lerDetalhe={acaoDetalheDaFatura.bind(null, cliente.id)}
          cancelar={acaoCancelarAssinatura.bind(null, cliente.id)}
        />
      </Miolo>
    </AjustesShell>
  )
}
