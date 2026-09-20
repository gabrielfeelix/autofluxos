import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { NOME_DO_TIPO, urgenciaDe, type Urgencia } from '@/core/atividades'
import { acharCliente } from '@/server/repos/clientes'
import { agenda } from '@/server/repos/atividades'
import { exigirCapacidadeNaPagina, filtroDoAcesso } from '@/server/permissoes'

export const dynamic = 'force-dynamic'

/**
 * A agenda da equipe (UI-13, T5.3).
 *
 * **O escopo é aplicado na consulta**, e não aqui: `filtroDoAcesso` vai para
 * `agenda()`, que o traduz em `where`. Filtrar depois de ler entregaria a
 * agenda inteira ao processo que não devia tê-la, e é o mesmo A19 que a F6
 * persegue na lista de contatos.
 *
 * **Nada nesta tela envia mensagem** (RB-33). É uma lista de lembretes para
 * pessoas; o cliente não é notificado por nada daqui.
 */
const TOM: Record<Urgencia, string> = {
  vencida: 'border-rose-400/50',
  hoje: 'border-amber-400/50',
  futura: 'border-line',
  'sem-prazo': 'border-line',
}

const ROTULO: Record<Urgencia, string> = {
  vencida: 'vencida',
  hoje: 'hoje',
  futura: '',
  'sem-prazo': 'sem prazo',
}

function agoraDoServidor(): number {
  return Date.now()
}

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await exigirCapacidadeNaPagina(clienteId, 'atender', 'proprios')
  const atividades = await agenda(clienteId, filtroDoAcesso(acesso, 'atender'))
  const agora = agoraDoServidor()

  const comUrgencia = atividades.map((atividade) => ({
    atividade,
    urgencia: urgenciaDe(atividade, agora),
  }))

  const vencidas = comUrgencia.filter((a) => a.urgencia === 'vencida')
  const hoje = comUrgencia.filter((a) => a.urgencia === 'hoje')
  const resto = comUrgencia.filter((a) => a.urgencia !== 'vencida' && a.urgencia !== 'hoje')

  return (
    <ClienteShell cliente={cliente} ativa="quadros">
      <main className="w-full max-w-[900px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Atividades</h1>
          <Link
            href={`/clientes/${cliente.id}/quadros`}
            className="text-[12px] text-dim underline"
          >
            voltar aos quadros
          </Link>
        </div>

        <p className="mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          O que a equipe marcou para fazer. São lembretes internos:{' '}
          <strong>nada aqui é enviado ao cliente</strong>.
        </p>

        {atividades.length === 0 ? (
          <p className="app-card px-5 py-10 text-center text-xs leading-5 text-dim">
            Nenhuma atividade aberta. Elas nascem na ficha de um contato ou no
            painel de uma oportunidade.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {[
              { titulo: 'Vencidas', itens: vencidas },
              { titulo: 'Hoje', itens: hoje },
              { titulo: 'Depois', itens: resto },
            ]
              .filter((grupo) => grupo.itens.length > 0)
              .map((grupo) => (
                <section key={grupo.titulo}>
                  <h2 className="mb-2 text-[13px] font-bold">
                    {grupo.titulo} <span className="text-dim">({grupo.itens.length})</span>
                  </h2>
                  <ul className="flex flex-col gap-1.5">
                    {grupo.itens.map(({ atividade, urgencia }) => (
                      <li
                        key={atividade.id}
                        className={`app-card flex items-center gap-3 border px-4 py-3 ${TOM[urgencia]}`}
                      >
                        <span className="flex-1">
                          <span className="block text-[13px]">{atividade.titulo}</span>
                          <span className="block text-[11px] text-dim">
                            {NOME_DO_TIPO[atividade.tipo]}
                            {ROTULO[urgencia] && ` · ${ROTULO[urgencia]}`}
                            {atividade.responsavelNome && ` · ${atividade.responsavelNome}`}
                          </span>
                        </span>
                        <Link
                          href={`/clientes/${cliente.id}/leads/${atividade.contatoId}`}
                          className="text-[11.5px] text-dim underline"
                        >
                          abrir contato
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </main>
    </ClienteShell>
  )
}
