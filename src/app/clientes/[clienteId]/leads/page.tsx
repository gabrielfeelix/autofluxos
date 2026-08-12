import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PainelShell } from '@/components/design/shell'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarLeads, type Lead } from '@/server/repos/leads'
import { horaExata, quando } from './quando'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <PainelShell>
      <main className="app-page-enter flex min-h-full flex-col px-[42px] pt-[34px] pb-[42px]">
        <nav className="mb-3 text-[12.5px] text-dim">
          <Link href="/" className="text-muted transition hover:text-accent">Clientes</Link>
          <span className="mx-2">/</span>
          <Link href={`/clientes/${cliente.id}`} className="text-muted transition hover:text-accent">
            {cliente.nome}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-soft">Leads</span>
        </nav>

        <div className="mb-[22px] flex items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Leads · {cliente.nome}</h1>
        </div>

        <Suspense fallback={<Esqueleto />}>
          <Tabela clienteId={cliente.id} />
        </Suspense>
      </main>
    </PainelShell>
  )
}

function Esqueleto() {
  return (
    <div className="app-card overflow-hidden">
      <div className="h-11 border-b border-white/[0.07] bg-white/[0.018]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-14 animate-pulse items-center gap-3 border-b border-white/[0.045] px-3.5">
          <span className="size-8 rounded-full bg-white/[0.06]" />
          <span className="h-3 w-36 rounded bg-white/[0.06]" />
        </div>
      ))}
      <span className="sr-only">Carregando os leads…</span>
    </div>
  )
}

function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

async function Tabela({ clienteId }: { clienteId: string }) {
  const [leads, canais] = await Promise.all([listarLeads(clienteId), listarCanais(clienteId)])
  const colunas = colunasDosCampos(leads)
  const esperando = leads.filter((lead) => lead.aguardando).length

  if (leads.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-[420px] text-center">
        {canais.length === 0 ? (
          <>
            <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim">SEM CANAL</p>
            <h2 className="text-[15.5px] font-bold">Nenhum número conectado</h2>
            <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
              Sem um número de WhatsApp ligado a um fluxo publicado, ninguém consegue conversar com o bot — e nenhum lead entra aqui.
            </p>
            <Link href={`/clientes/${clienteId}`} className="app-secondary-button mt-5 inline-block px-5 py-2.5 text-[13px]">
              Conectar um número
            </Link>
          </>
        ) : (
          <>
            <span className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-bold text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Número no ar
            </span>
            <h2 className="text-[15.5px] font-bold">Nenhum lead ainda</h2>
            <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
              Quando alguém conversar com o bot, a pessoa aparece aqui com tudo o que o fluxo coletar.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="-mt-[53px] mb-[22px] flex justify-end gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-muted">
          {leads.length} {leads.length === 1 ? 'pessoa' : 'pessoas'}
        </span>
        {esperando > 0 && (
          <span className="rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-3 py-1 text-[11px] font-bold text-rose-300">
            {esperando} esperando humano
          </span>
        )}
      </div>

      <div className="app-card overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Cabecalho>Contato</Cabecalho>
              {colunas.map((coluna) => <Cabecalho key={coluna} mono>{coluna}</Cabecalho>)}
              <Cabecalho>Situação</Cabecalho>
              <Cabecalho>Última mensagem</Cabecalho>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.contatoId} className="border-b border-white/[0.045] transition last:border-0 hover:bg-white/[0.03]">
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={lead.nome} />
                    <div className="min-w-0">
                      <Link
                        href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
                        className="block truncate text-[13px] font-bold transition hover:text-accent"
                      >
                        {lead.nome ?? 'sem nome'}
                      </Link>
                      <span className="block whitespace-nowrap font-mono text-[10px] text-dim">{lead.waId}</span>
                    </div>
                  </div>
                </td>
                {colunas.map((coluna) => (
                  <td key={coluna} className="max-w-48 truncate px-3.5 py-3 font-mono text-[11px] text-[#97a2b4]">
                    {lead.campos[coluna] || <span className="text-dim">—</span>}
                  </td>
                ))}
                <td className="px-3.5 py-3">
                  {lead.aguardando ? (
                    <>
                      <span className="inline-flex rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-2.5 py-1 text-[10.5px] font-bold text-rose-300">
                        AGUARDANDO HUMANO
                      </span>
                      <span className="mt-1 block max-w-52 truncate text-[10.5px] text-dim" title={horaExata(lead.aguardando.desde)}>
                        {quando(lead.aguardando.desde)} · {lead.aguardando.motivo}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-emerald-300">
                      COM O BOT
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 text-[11.5px] whitespace-nowrap text-muted">
                  {lead.ultimaEm ? (
                    <>
                      <span title={horaExata(lead.ultimaEm)}>{quando(lead.ultimaEm)}</span>
                      {lead.ultimoTexto && (
                        <span className="block max-w-52 truncate text-[10.5px] text-dim">
                          {lead.ultimaDirecao === 'saida' && `${lead.ultimaEntregue ? 'bot: ' : 'envio não confirmado: '}`}{lead.ultimoTexto}
                        </span>
                      )}
                    </>
                  ) : 'sem mensagem'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Cabecalho({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <th className={`px-3.5 py-3.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase ${mono ? 'font-mono normal-case tracking-[0.02em]' : ''}`}>
      {children}
    </th>
  )
}

function Avatar({ nome }: { nome: string | null }) {
  const iniciais = (nome ?? '?').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.05] text-[10px] font-bold text-[#97a2b4]">
      {iniciais}
    </span>
  )
}
