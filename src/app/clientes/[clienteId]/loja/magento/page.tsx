import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { LojaMagento } from '@/components/cliente/loja-magento'
import {
  acaoConectarToken,
  acaoDesconectarToken,
  acaoDesligarLoja,
  acaoLigarLoja,
  acaoTestarLoja,
} from '@/server/acoes-loja'
import { acharCliente } from '@/server/repos/clientes'
import { estadoDoToken } from '@/server/adaptador-da-loja'
import { lojaDaConta } from '@/server/repos/lojas'

export const dynamic = 'force-dynamic'

/**
 * A loja Magento da conta, para o bot consultar catálogo ao vivo.
 *
 * Plano: docs/superpowers/plans/2026-09-23-magento-cross-sell.md. Só leitura:
 * o bot busca, mostra preço e estoque e manda o link, e quem fecha a compra é
 * a loja.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [loja, token] = await Promise.all([lojaDaConta(cliente.id), estadoDoToken(cliente.id)])

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <Miolo largura="leitura">
        <CabecalhoDaTela
          trilha={[
            { rotulo: 'Integrações', href: `/clientes/${cliente.id}/loja` },
            { rotulo: 'Magento' },
          ]}
          titulo={<>Loja Magento</>}
          descricao={<>O bot consulta a loja <strong className="text-soft">na hora da conversa</strong>: diz se tem,
          quanto custa e manda o link do produto. Ele só lê. Nada é criado, alterado ou apagado na
          loja, e quem fecha a compra é o site.</>}
        />

        <LojaMagento
          inicial={
            loja
              ? {
                  endereco: loja.endereco,
                  ativa: loja.ativa,
                  verificadaEm: loja.verificadaEm,
                  tokenConectado: loja.estoqueExato !== 'desligado',
                  tokenRecusado: token === 'recusado',
                }
              : null
          }
          fluxosHref={`/clientes/${cliente.id}/fluxos`}
          testar={acaoTestarLoja.bind(null, cliente.id)}
          ligar={acaoLigarLoja.bind(null, cliente.id)}
          desligar={acaoDesligarLoja.bind(null, cliente.id)}
          conectarToken={acaoConectarToken.bind(null, cliente.id)}
          desconectarToken={acaoDesconectarToken.bind(null, cliente.id)}
          // O guia mora no repositório público, e é o que se manda ao técnico
          // da loja: ele não tem acesso ao painel.
          guiaHref="https://github.com/gabrielfeelix/autofluxos/blob/main/docs/GUIA-MAGENTO-LOJISTA.md"
        />
      </Miolo>
    </ClienteShell>
  )
}
