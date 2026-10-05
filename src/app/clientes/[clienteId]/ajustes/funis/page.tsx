import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { FunisDeVenda } from '@/components/quadros/funis-de-venda'
import { acharCliente } from '@/server/repos/clientes'
import { listarQuadros } from '@/server/repos/quadros'
import { ehCorDaEtapa } from '@/core/quadros'

export const dynamic = 'force-dynamic'

/**
 * Configurações > Funis de venda: montar os funis (nome, padrão, funil
 * seguinte, etapas) num lugar só. Trabalhar neles continua no Funil de vendas.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, quadros] = await Promise.all([acharCliente(clienteId), listarQuadros(clienteId)])
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="funis">
      <Miolo largura="cheia">
        <CabecalhoDaTela
          trilha={[{ rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` }, { rotulo: 'Funis de venda' }]}
          titulo={<>Funis de venda</>}
          descricao={<>As etapas por onde cada negócio anda, na ordem. O funil padrão recebe sozinho quem chega
          pela primeira vez; ganhar num funil pode passar o negócio para o seguinte.</>}
        />
        <FunisDeVenda
          clienteId={cliente.id}
          funis={quadros.map((quadro) => ({
            id: quadro.id,
            nome: quadro.nome,
            padrao: quadro.padrao,
            seguinteId: quadro.seguinteId ?? null,
            etapas: quadro.etapas.map((etapa) => ({
              id: etapa.id,
              nome: etapa.nome,
              tipo: etapa.tipo ?? 'normal',
              limiteDeDias: etapa.limiteDeDias ?? null,
              cor: ehCorDaEtapa(etapa.cor) ? etapa.cor : null,
            })),
          }))}
        />
      </Miolo>
    </AjustesShell>
  )
}
