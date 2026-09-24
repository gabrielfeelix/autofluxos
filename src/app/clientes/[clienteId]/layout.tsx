import { notFound } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { BarraDoCliente } from '@/components/design/barra-do-cliente'
import { CabecalhoDoCliente } from '@/components/design/cabecalho-do-cliente'
import { MolduraDoCliente } from '@/components/design/moldura-do-cliente'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { FaixaDeSuporte } from '@/components/conta/faixa-de-suporte'
import { FaixaDoPlano } from '@/components/conta/faixa-do-plano'
import { acharCliente } from '@/server/repos/clientes'

/**
 * A barra da conta fica aqui para **não recarregar a cada clique**.
 *
 * Antes cada página desenhava a sua (`ClienteShell`), e o Next desmontava a
 * barra inteira em toda troca de tela. No layout ela monta uma vez e só o miolo
 * muda. A conferência de acesso da seção continua em cada página, dentro da
 * `ClienteShell`: layout não roda de novo na navegação.
 */
export default async function LayoutDoCliente({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <MolduraDoCliente
      base={`/clientes/${cliente.id}`}
      barra={<BarraDoCliente cliente={cliente} />}
      cabecalho={<CabecalhoDoCliente clienteId={cliente.id} />}
      faixas={
        <>
          <FaixaDeImpersonacao />
          <FaixaDeSuporte clienteId={cliente.id} />
          {/* Não segura a tela: o aviso chega quando chegar. */}
          <Suspense fallback={null}>
            <FaixaDoPlano clienteId={cliente.id} />
          </Suspense>
        </>
      }
    >
      {children}
    </MolduraDoCliente>
  )
}
