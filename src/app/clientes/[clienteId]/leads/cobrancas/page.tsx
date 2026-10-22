import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NOME_DO_GATEWAY } from '@/channels/pagamento'
import { TabelaDeCobrancas, type LinhaDeCobranca } from '@/components/cobrancas/tabela-de-cobrancas'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Miolo } from '@/components/design/miolo'
import { SemAcesso } from '@/components/design/sem-acesso'
import { capacidadeNaPagina } from '@/server/permissoes'
import { recusaDoPlano } from '@/server/recursos-do-plano'
import { acharCliente } from '@/server/repos/clientes'
import { listarCobrancas, nomesDosCobrados } from '@/server/repos/cobrancas'
import { conexaoAtiva } from '@/server/repos/pagamentos'

export const dynamic = 'force-dynamic'

/**
 * CRM > Cobranças (cobrança no chat, etapa C): o que foi cobrado pela
 * conversa, e se pagou.
 *
 * **A capacidade é `ler_valores`**: a tela é feita de dinheiro, como Vendas.
 * Cancelar pede `registrar_venda`, conferido na ação.
 *
 * Os status vêm sozinhos: pago chega pelo aviso do gateway, vencido pelo
 * relógio. Ninguém marca nada à mão, e é isso que separa esta tela de uma
 * planilha de "quem já me pagou".
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'ler_valores', 'todos')
  if (!acesso) {
    return (
      <ClienteShell cliente={cliente} ativa="leads">
        <SemAcesso clienteId={clienteId} oQue="Cobranças" />
      </ClienteShell>
    )
  }

  const [cobrancas, conexao, recusa] = await Promise.all([
    listarCobrancas(clienteId, { limite: 500 }),
    conexaoAtiva(clienteId),
    recusaDoPlano(clienteId, 'integracoes'),
  ])
  const nomes = await nomesDosCobrados(
    clienteId,
    cobrancas.flatMap((c) => (c.contatoId ? [c.contatoId] : [])),
  )

  const linhas: LinhaDeCobranca[] = cobrancas.map((c) => ({
    id: c.id,
    contatoId: c.contatoId,
    contato: c.contatoId ? nomes.get(c.contatoId) || 'Sem nome' : 'Contato apagado',
    descricao: c.descricao,
    valorCentavos: c.valorCentavos,
    status: c.status,
    gateway: c.gateway,
    pix: c.pixCopiaCola,
    link: c.link,
    venceEm: c.venceEm,
    pagaEm: c.pagaEm,
    criadoEm: c.criadoEm,
    criadaPor: c.criadaPor,
    origem: c.origem,
  }))

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <Miolo largura="cheia">
        <TabelaDeCobrancas
          clienteId={clienteId}
          inicial={linhas}
          topo={{
            trilha: [{ rotulo: 'CRM' }, { rotulo: 'Cobranças' }],
            titulo: 'Cobranças',
            descricao: conexao ? (
              <>
                Tudo o que foi cobrado pelas conversas, recebendo na conta do{' '}
                <strong className="text-soft">{NOME_DO_GATEWAY[conexao.gateway]}</strong>
                {conexao.ambiente === 'teste' ? ' em modo de teste' : ''}. O status muda sozinho quando a pessoa
                paga ou a cobrança vence.
              </>
            ) : (
              <>
                Tudo o que foi cobrado pelas conversas.{' '}
                {recusa ? (
                  recusa
                ) : (
                  <>
                    Para cobrar, conecte a conta da empresa em{' '}
                    <Link href={`/clientes/${clienteId}/ajustes/pagamentos`} className="font-semibold text-primary hover:underline">
                      Configurações &gt; Pagamentos
                    </Link>
                    .
                  </>
                )}
              </>
            ),
          }}
        />
      </Miolo>
    </ClienteShell>
  )
}
