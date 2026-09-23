import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
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
    <AjustesShell cliente={cliente} ativa="integracoes">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Todas as conexões', href: `/clientes/${cliente.id}/ajustes/integracoes` },
            { rotulo: 'Magento' },
          ]}
        />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Loja Magento</h1>
        <p className="mt-1 mb-6 max-w-[600px] text-[13px] leading-6 text-muted">
          O bot consulta a loja <strong className="text-soft">na hora da conversa</strong>: diz se tem,
          quanto custa e manda o link do produto. Ele só lê. Nada é criado, alterado ou apagado na
          loja, e quem fecha a compra é o site.
        </p>

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
      </main>
    </AjustesShell>
  )
}
