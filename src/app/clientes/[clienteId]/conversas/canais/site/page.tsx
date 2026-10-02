import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { ConfigurarChatDoSite } from '@/components/canais/configurar-chat-do-site'
import { CONFIG_PADRAO } from '@/core/chat-do-site'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { acharCliente } from '@/server/repos/clientes'
import { chatDoSite } from '@/server/repos/canais-site'
import { acharFluxo } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

/**
 * O chat do site: ligar, dizer onde ele pode aparecer, dar a cara da loja, e
 * copiar a linha que vai no HTML.
 *
 * O endereço do script sai do próprio pedido, e não de uma constante: em
 * produção é `autofluxos.4yu.com.br`, no ambiente local é `localhost`, e o
 * trecho copiado de cada um aponta para o servidor que o gerou.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const canal = await chatDoSite(clienteId)
  const principal = canal?.flowId ? await acharFluxo(canal.flowId) : null

  const cabecalhos = await headers()
  const anfitriao = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? 'autofluxos.4yu.com.br'
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? (anfitriao.startsWith('localhost') ? 'http' : 'https')

  return (
    <ClienteShell cliente={cliente} ativa="canais">
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[46px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Canais', href: `/clientes/${cliente.id}/conversas/canais` },
            { rotulo: 'Site' },
          ]}
        />
        <CabecalhoDaTela
          titulo="Chat no site"
          descricao={`${DEFINICAO_DO_CANAL.site.resumo} O visitante conversa com os mesmos fluxos e a mesma IA do WhatsApp, e a equipe responde pelo Inbox.`}
        />

        <ConfigurarChatDoSite
          clienteId={cliente.id}
          inicial={{
            ligado: canal?.status === 'ativo',
            existe: Boolean(canal),
            chave: canal?.chave ?? null,
            config: canal?.config ?? CONFIG_PADRAO,
          }}
          fluxoPrincipal={principal?.nome ?? null}
          urlDoScript={`${protocolo}://${anfitriao}/chat/v1.js`}
        />
      </main>
    </ClienteShell>
  )
}
