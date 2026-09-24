import Link from 'next/link'
import { NovaOrganizacao } from '@/components/admin/nova-organizacao'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { Numero, TelaDaAdministracao } from '@/components/admin/partes'
import { acharPlano, fracaoUsada } from '@/core/planos'
import { horaExata, quando } from '@/lib/quando'
import { acaoCriarExemplo } from '@/server/acoes'
import { contarAlertasAbertos } from '@/server/repos/alertas'
import { listarClientes, resumirAtendimento } from '@/server/repos/clientes'
import { consumoDeTodasAsContas } from '@/server/repos/plano'
import { pedidosDePlano } from '@/server/repos/pedidos-de-plano'
import { listarAtos } from '@/server/repos/auditoria'
import { planosVigentes } from '@/server/repos/planos'
import { verboDoAto } from '@/core/atos-da-auditoria'

export const dynamic = 'force-dynamic'

/**
 * A primeira tela da administração, no lugar da antiga `/painel`.
 *
 * Quatro números respondem "como está a plataforma hoje", e os cartões
 * respondem a única pergunta que pede ação imediata: **onde tem gente
 * esperando**. É a única tela da administração com cartão; todo o resto é
 * tabela, porque o resto é consulta, não fila.
 */
export default async function VisaoGeral() {
  const [organizacoes, atendimento, consumo, alertas, pedidos, recentes] = await Promise.all([
    listarClientes(),
    resumirAtendimento(),
    consumoDeTodasAsContas(),
    contarAlertasAbertos().catch(() => 0),
    pedidosDePlano().catch(() => []),
    listarAtos({ limite: 6 }).catch(() => []),
  ])
  const planos = await planosVigentes()

  const esperando = organizacoes
    .map((organizacao) => ({ organizacao, resumo: atendimento.get(organizacao.id) }))
    .filter(({ resumo }) => (resumo?.esperandoPessoa ?? 0) > 0)
    .sort((a, b) => (b.resumo?.esperandoPessoa ?? 0) - (a.resumo?.esperandoPessoa ?? 0))
  const pessoasEsperando = esperando.reduce((soma, { resumo }) => soma + (resumo?.esperandoPessoa ?? 0), 0)
  const ativas = consumo.filter((conta) => conta.conversas > 0).length
  const conversas = consumo.reduce((soma, conta) => soma + conta.conversas, 0)
  const pedidosAbertos = pedidos.filter((pedido) => pedido.situacao === 'aberto').length
  const pertoDoLimite = consumo
    .map((conta) => ({ conta, fracao: fracaoUsada(conta.conversas, planos.find((plano) => plano.id === conta.plano) ?? acharPlano(conta.plano)) }))
    .filter(({ fracao }) => fracao >= 0.8)
    .sort((a, b) => b.fracao - a.fracao)

  return (
    <TelaDaAdministracao
      titulo="Visão geral"
      descricao="A plataforma hoje: onde tem gente esperando, o uso do mês e o que precisa de atenção."
      acoes={
        <NovaOrganizacao planos={planos} />
      }
    >
      <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="Pessoas esperando"
          valor={pessoasEsperando}
          tom={pessoasEsperando > 0 ? 'aviso' : 'normal'}
          detalhe={pessoasEsperando > 0 ? `em ${esperando.length} ${esperando.length === 1 ? 'organização' : 'organizações'}` : 'ninguém sem resposta'}
        />
        <Numero
          rotulo="Organizações ativas"
          valor={`${ativas}`}
          detalhe={`de ${organizacoes.length} com conversa no mês`}
          href="/admin/organizacoes"
        />
        <Numero rotulo="Conversas no mês" valor={conversas.toLocaleString('pt-BR')} detalhe="somando todas as organizações" href="/admin/consumo" />
        <Numero
          rotulo="Precisa de atenção"
          valor={alertas + pedidosAbertos}
          tom={alertas + pedidosAbertos > 0 ? 'perigo' : 'ok'}
          detalhe={`${alertas} ${alertas === 1 ? 'alerta' : 'alertas'} · ${pedidosAbertos} ${pedidosAbertos === 1 ? 'pedido' : 'pedidos'} de plano`}
          href={pedidosAbertos > 0 && alertas === 0 ? '/admin/pedidos' : '/admin/alertas'}
        />
      </section>

      {organizacoes.length === 0 ? (
        <section className="app-card border-dashed px-10 py-14 text-center">
          <p className="text-[14px] font-semibold text-soft">Nenhuma organização ainda</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
            Crie uma organização vazia ou comece com o exemplo pronto para conhecer o fluxo completo.
          </p>
          <form action={acaoCriarExemplo} className="mt-5">
            <button type="submit" className="app-primary-button px-5 py-2.5 text-[13px]">
              Criar organização de exemplo
            </button>
          </form>
        </section>
      ) : (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-labelledby="titulo-esperando">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="titulo-esperando" className="text-[15px] font-bold">
                Onde tem gente esperando
              </h2>
              <Link href="/admin/organizacoes" className="text-[12px] font-semibold text-primary hover:underline">
                Ver todas →
              </Link>
            </div>
            {esperando.length === 0 ? (
              <div className="app-card flex items-center gap-3 px-5 py-5">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-400/[0.12] text-ok">
                  ✓
                </span>
                <p className="text-[13px] text-muted">
                  Nenhuma conversa esperando uma pessoa agora, em nenhuma organização.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {esperando.map(({ organizacao, resumo }) => (
                  <li key={organizacao.id}>
                    <article className="app-card flex h-full flex-col gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <LogoDoCliente cliente={organizacao} tamanho={38} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/organizacoes/${organizacao.id}`} className="block truncate text-[14px] font-bold hover:text-primary">
                            {organizacao.nome}
                          </Link>
                          <p
                            className="truncate text-[11.5px] text-dim"
                            title={resumo?.ultimaAtividade ? horaExata(resumo.ultimaAtividade.toISOString()) : undefined}
                          >
                            {resumo?.ultimaAtividade ? `última mensagem ${quando(resumo.ultimaAtividade.toISOString())}` : 'sem conversa'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <p className="text-aviso">
                          <strong className="text-[26px] leading-none font-bold tabular-nums">{resumo?.esperandoPessoa}</strong>{' '}
                          <span className="text-[12.5px] font-semibold">esperando</span>
                        </p>
                        <Link href={`/clientes/${organizacao.id}/inbox`} className="app-secondary-button px-3 py-1.5 text-[12px]">
                          Abrir o Inbox
                        </Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-7">
          <section aria-labelledby="titulo-limite">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="titulo-limite" className="text-[15px] font-bold">
                Perto do limite do plano
              </h2>
              <Link href="/admin/consumo" className="text-[12px] font-semibold text-primary hover:underline">
                Consumo →
              </Link>
            </div>
            <div className="app-card overflow-hidden">
              {pertoDoLimite.length === 0 ? (
                <p className="px-5 py-5 text-[13px] text-muted">Nenhuma organização passou de 80% das conversas do plano.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pertoDoLimite.slice(0, 6).map(({ conta, fracao }) => (
                    <li key={conta.clienteId}>
                      <Link href={`/admin/organizacoes/${conta.clienteId}/plano`} className="block px-4 py-3 transition hover:bg-surface">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-semibold">{conta.nome}</span>
                          <span className={`text-[12px] font-bold tabular-nums ${fracao > 1 ? 'text-perigo' : 'text-aviso'}`}>
                            {Math.round(fracao * 100)}%
                          </span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
                          <span
                            className={`block h-full rounded-full ${fracao > 1 ? 'bg-perigo' : 'bg-aviso'}`}
                            style={{ width: `${Math.min(100, Math.round(fracao * 100))}%` }}
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="titulo-recentes">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="titulo-recentes" className="text-[15px] font-bold">
                Últimos acontecimentos
              </h2>
              <Link href="/admin/auditoria" className="text-[12px] font-semibold text-primary hover:underline">
                Auditoria →
              </Link>
            </div>
            <div className="app-card overflow-hidden">
              {recentes.length === 0 ? (
                <p className="px-5 py-5 text-[13px] text-muted">Nada registrado ainda.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recentes.map((ato) => (
                    <li key={ato.id} className="flex items-baseline gap-3 px-4 py-2.5">
                      <p className="min-w-0 flex-1 truncate text-[12.5px]">
                        <strong className="font-semibold">{ato.autorEmail?.split('@')[0] || 'alguém'}</strong>{' '}
                        <span className="text-muted">{verboDoAto(ato.acao)}</span>{' '}
                        {ato.alvoNome && <strong className="font-semibold">{ato.alvoNome}</strong>}
                        {ato.contaNome && <span className="text-dim"> · {ato.contaNome}</span>}
                      </p>
                      <time dateTime={ato.quando} title={horaExata(ato.quando)} className="shrink-0 text-[11px] text-dim">
                        {quando(ato.quando)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          </div>
        </div>
      )}
    </TelaDaAdministracao>
  )
}
