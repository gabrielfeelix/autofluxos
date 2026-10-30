import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { ConectarCardapioWeb } from '@/components/loja/conectar-cardapio-web'
import { tokenDoWebhook } from '@/server/cardapios/token-do-webhook'
import { capacidadeNaPagina } from '@/server/permissoes'
import { cardapioDaConta } from '@/server/repos/cardapios'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

const ENDERECO_DO_WEBHOOK = 'https://dialogon.com.br/api/webhook/cardapio-web/'

/**
 * Integrações > Cardápio e delivery > Cardápio Web. A chave e o token do
 * webhook são de quem configura a operação; o token só é montado aqui, no
 * servidor, para quem pode ver.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="loja">
        <SemAcesso clienteId={clienteId} oQue="Cardápio Web" />
      </ClienteShell>
    )
  }

  const cardapio = await cardapioDaConta(clienteId, 'cardapio_web')
  const ligado = cardapio?.ativo && cardapio.conexaoId ? cardapio : null

  return (
    <ClienteShell cliente={cliente} ativa="loja">
      <ConectarCardapioWeb
        clienteId={clienteId}
        conectado={
          ligado
            ? {
                loja: ligado.idNaPlataforma ?? '',
                avisarCliente: ligado.avisarCliente,
                ultimaLeitura: ligado.pedidosLidosAte,
                webhook: { url: `${ENDERECO_DO_WEBHOOK}${clienteId}`, token: tokenDoWebhook(clienteId, 'cardapio_web') },
              }
            : null
        }
      />
    </ClienteShell>
  )
}
