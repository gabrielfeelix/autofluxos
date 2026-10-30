import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { SemAcesso } from '@/components/design/sem-acesso'
import { SistemasDoRamo, type EstadoDaAgendaNaTela } from '@/components/conexoes/sistemas-do-ramo'
import { pacoteDo } from '@/core/nichos'
import { sistemasParaAConta, type SistemaDoRamo } from '@/core/sistemas-dos-ramos'
import { acaoConectarAgenda, acaoDesligarAgenda, acaoSolicitarSistema, acaoTestarAgenda } from '@/server/acoes-agendas'
import { capacidadeNaPagina } from '@/server/permissoes'
import { agendasDaConta } from '@/server/repos/agendas'
import { acharCliente } from '@/server/repos/clientes'
import { pedidosDeSistemas } from '@/server/repos/lojas'
import { nichoDaConta } from '@/server/repos/recursos'

export const dynamic = 'force-dynamic'

/** Configurações > Integrações > Sistemas do seu ramo. A chave é de quem configura a operação. */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos')
  if (!acesso) {
    return (
      <AjustesShell cliente={cliente} ativa="integracoes">
        <SemAcesso clienteId={clienteId} oQue="os sistemas do ramo" />
      </AjustesShell>
    )
  }

  const [nicho, agendas, solicitadas] = await Promise.all([
    nichoDaConta(cliente.id),
    agendasDaConta(cliente.id),
    pedidosDeSistemas(cliente.id),
  ])
  const pacote = pacoteDo(nicho)
  const estados: Partial<Record<SistemaDoRamo, EstadoDaAgendaNaTela>> = Object.fromEntries(
    agendas.map((a) => [a.plataforma, { ativo: a.ativo && Boolean(a.conexaoId), conferidoEm: a.conferidoEm }]),
  )

  return (
    <AjustesShell cliente={cliente} ativa="integracoes">
      <SistemasDoRamo
        clienteId={cliente.id}
        nomeDoRamo={pacote?.nome ?? null}
        sistemas={sistemasParaAConta(pacote)}
        agendas={estados}
        solicitadas={solicitadas}
        conectar={acaoConectarAgenda.bind(null, cliente.id)}
        testar={acaoTestarAgenda.bind(null, cliente.id)}
        desligar={acaoDesligarAgenda.bind(null, cliente.id)}
        solicitar={acaoSolicitarSistema.bind(null, cliente.id)}
      />
    </AjustesShell>
  )
}
