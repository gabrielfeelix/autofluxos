import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Numero, Selo } from '@/components/admin/partes'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import { verboDoAto } from '@/core/atos-da-auditoria'
import { fracaoUsada } from '@/core/planos'
import { horaExata, quando } from '@/lib/quando'
import { listarAtos } from '@/server/repos/auditoria'
import { acharOrganizacao, canaisDaOrganizacao } from '@/server/repos/organizacoes'
import { planoVigente } from '@/server/repos/planos'

export const dynamic = 'force-dynamic'

/** Resumo: os números do mês, os canais e o que aconteceu por último. */
export default async function Resumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const organizacao = await acharOrganizacao(id)
  if (!organizacao) notFound()
  const [plano, canais, atos] = await Promise.all([
    planoVigente(organizacao.plano || 'essencial'),
    canaisDaOrganizacao(id).catch(() => []),
    listarAtos({ contaId: id, limite: 8 }).catch(() => []),
  ])
  const fracao = fracaoUsada(organizacao.conversasNoMes, plano)

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="Esperando uma pessoa"
          valor={organizacao.esperando}
          tom={organizacao.esperando > 0 ? 'aviso' : 'normal'}
          detalhe={organizacao.ultimaAtividade ? `última mensagem ${quando(organizacao.ultimaAtividade)}` : 'sem conversa ainda'}
          href={organizacao.esperando > 0 ? `/clientes/${id}/inbox` : undefined}
        />
        <Numero
          rotulo="Conversas no mês"
          valor={organizacao.conversasNoMes.toLocaleString('pt-BR')}
          tom={fracao > 1 ? 'perigo' : fracao >= 0.8 ? 'aviso' : 'normal'}
          detalhe={`de ${plano.conversas.toLocaleString('pt-BR')} do ${plano.nome} (${Math.round(fracao * 100)}%)`}
          href={`/admin/organizacoes/${id}/plano`}
        />
        <Numero rotulo="Contatos" valor={organizacao.contatos.toLocaleString('pt-BR')} detalhe={`${organizacao.automacoesNoAr} ${organizacao.automacoesNoAr === 1 ? 'automação no ar' : 'automações no ar'}`} />
        <Numero
          rotulo="Pessoas com acesso"
          valor={organizacao.pessoas}
          tom={organizacao.pessoas === 0 ? 'aviso' : 'normal'}
          detalhe={organizacao.pessoas === 0 ? 'só o suporte entra' : 'ver e mudar funções'}
          href={`/admin/organizacoes/${id}/pessoas`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-canais" className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 id="titulo-canais" className="text-[14px] font-bold">
              Canais conectados
            </h2>
            <Link href={`/clientes/${id}/ajustes/integracoes`} className="text-[12px] font-semibold text-primary hover:underline">
              Ver conexões →
            </Link>
          </header>
          {canais.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">Nenhum canal ligado. Sem canal, a organização não recebe mensagem.</p>
          ) : (
            <ul className="divide-y divide-line">
              {canais.map((canal) => (
                <li key={canal.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted">
                    <LogoDoCanal canal={canal.tipo === 'Instagram' ? 'instagram' : 'whatsapp'} tamanho={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{canal.nome}</span>
                    <span className="block text-[11.5px] text-dim">{canal.tipo} · ligado {quando(canal.desde)}</span>
                  </span>
                  {canal.status && canal.status !== 'ativo' && canal.status !== 'conectado' ? <Selo tom="aviso">{canal.status}</Selo> : <Selo tom="ok">Ligado</Selo>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-atos" className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 id="titulo-atos" className="text-[14px] font-bold">
              Últimos acontecimentos
            </h2>
            <Link href={`/admin/organizacoes/${id}/auditoria`} className="text-[12px] font-semibold text-primary hover:underline">
              Auditoria →
            </Link>
          </header>
          {atos.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">Nada registrado nesta organização ainda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {atos.map((ato) => (
                <li key={ato.id} className="flex items-baseline gap-3 px-5 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[12.5px]">
                    <strong className="font-semibold">{ato.autorEmail || 'alguém'}</strong> <span className="text-muted">{verboDoAto(ato.acao)}</span>{' '}
                    {ato.alvoNome && <strong className="font-semibold">{ato.alvoNome}</strong>}
                  </p>
                  <time dateTime={ato.quando} title={horaExata(ato.quando)} className="shrink-0 text-[11px] text-dim">
                    {quando(ato.quando)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
