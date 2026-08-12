import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import { PainelShell } from '@/components/design/shell'
import { CaixaDeResposta } from '@/components/lead/responder'
import { acaoEncerrarAtendimento, acaoResponderLead } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { contextoDeResposta } from '@/server/repos/conversas'
import { acharLead, lerConversa } from '@/server/repos/leads'
import { horaExata, quando } from '../quando'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; contatoId: string }>
}) {
  const { clienteId, contatoId } = await params
  const [cliente, lead] = await Promise.all([acharCliente(clienteId), acharLead(clienteId, contatoId)])
  if (!cliente || !lead) notFound()

  const campos = Object.entries(lead.campos)
  const nome = lead.nome ?? 'sem nome'
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

  // O primeiro nome basta na caixa de resposta: "Responder Maria Aparecida da
  // Silva pelo WhatsApp…" não cabe e não ajuda.
  const primeiroNome = lead.nome?.split(' ')[0] ?? 'esta pessoa'

  // Quanto ainda dá para responder em texto livre. `null` fecha a caixa — e a
  // conta é feita aqui, no servidor, porque o relógio do navegador de quem abre
  // a tela não é fonte de verdade para uma regra da Meta.
  const contexto = await contextoDeResposta(clienteId, contatoId)
  const restante = restaDaJanela(contexto?.ultimaEntradaEm ?? null)
  const janela = restante && restante > 0 ? comoFalta(restante) : null

  return (
    <PainelShell>
      <main className="app-page-enter max-w-[1080px] px-[46px] pt-[34px] pb-[46px]">
        <nav className="mb-3.5 text-[12.5px] text-dim">
          <Link href="/" className="text-muted transition hover:text-accent">Clientes</Link>
          <span className="mx-2">/</span>
          <Link href={`/clientes/${cliente.id}`} className="text-muted transition hover:text-accent">{cliente.nome}</Link>
          <span className="mx-2">/</span>
          <Link href={`/clientes/${cliente.id}/leads`} className="text-muted transition hover:text-accent">Leads</Link>
          <span className="mx-2">/</span>
          <span className="text-soft">{nome}</span>
        </nav>

        <header className="mb-4 flex items-center gap-3.5">
          <span className="flex size-11 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.05] text-[12px] font-bold text-[#97a2b4]">
            {iniciais}
          </span>
          <div className="min-w-0">
            <h1 className="text-[21px] font-bold tracking-[-0.02em]">{nome}</h1>
            <p className="mt-0.5 font-mono text-[11px] text-dim">{lead.waId}</p>
          </div>
          <span className="flex-1" />
          <span className={`rounded-full border px-3 py-1 text-[10.5px] font-bold ${lead.aguardando ? 'border-rose-400/25 bg-rose-400/[0.09] text-rose-300' : 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'}`}>
            {lead.aguardando ? 'AGUARDANDO HUMANO' : 'COM O BOT'}
          </span>
        </header>

        {lead.aguardando && (
          <div className="mb-[18px] flex items-center gap-3 rounded-[13px] border border-rose-400/25 bg-rose-400/[0.06] px-[17px] py-[13px]">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
            <div className="min-w-0 flex-1">
              <strong className="block text-[13px] text-rose-300">Esperando uma pessoa {quando(lead.aguardando.desde)}</strong>
              <span className="mt-0.5 block text-[11.5px] text-muted">Motivo do handoff: {lead.aguardando.motivo}</span>
            </div>
            {/*
              O que este botão faz, e por que ele é um só: tira o lead da fila e
              devolve o contato ao bot. Enquanto a sessão estiver com uma pessoa,
              o bot fica calado com esse número — então "atendi" e "pode voltar
              a atender" são o mesmo ato, e separar os dois só criaria um estado
              em que ninguém responde.
            */}
            <form action={acaoEncerrarAtendimento.bind(null, clienteId, contatoId)}>
              <button
                type="submit"
                title="Resolve o handoff. A próxima mensagem desta pessoa começa uma conversa nova com o bot."
                className="shrink-0 rounded-[9px] border border-rose-400/30 bg-rose-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-rose-200 transition hover:bg-rose-400/[0.2]"
              >
                Já atendi
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-[18px]">
          <section className="app-card overflow-hidden">
            <h2 className="border-b border-white/[0.06] px-[18px] py-3.5 text-[13px] font-bold">O que o fluxo coletou</h2>
            {campos.length === 0 ? (
              <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
                Nada coletado — a conversa não chegou a preencher nenhuma variável.
              </p>
            ) : (
              <dl>
                {campos.map(([chave, valor]) => (
                  <div key={chave} className="border-b border-white/[0.045] px-[18px] py-[11px] last:border-0">
                    <dt className="font-mono text-[10px] tracking-[0.04em] text-dim">{chave}</dt>
                    <dd className="mt-1 truncate text-[13px] font-semibold">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="app-card flex max-h-[620px] min-h-[360px] flex-col overflow-hidden">
            <header className="flex items-center gap-2 border-b border-white/[0.06] px-[18px] py-3.5">
              <h2 className="flex-1 text-[13px] font-bold">Conversa</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-dim">
                <span className="size-1.5 rounded-full bg-dim" /> {lead.waId}
              </span>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-[18px]">
              <Suspense fallback={<HistoricoEsqueleto />}>
                <Historico contatoId={contatoId} nomeDoLead={lead.nome} />
              </Suspense>
            </div>
            <CaixaDeResposta
              acao={acaoResponderLead.bind(null, clienteId, contatoId)}
              restaDaJanela={janela}
              nome={primeiroNome}
            />
          </section>
        </div>
      </main>
    </PainelShell>
  )
}

function HistoricoEsqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-9 w-[46%] self-end rounded-[13px_13px_4px_13px] bg-accent/[0.07]" />
      <div className="h-9 w-[34%] rounded-[13px_13px_13px_4px] bg-white/[0.05]" />
      <div className="h-9 w-[52%] self-end rounded-[13px_13px_4px_13px] bg-accent/[0.07]" />
      <span className="sr-only">Carregando a conversa…</span>
    </div>
  )
}

async function Historico({ contatoId, nomeDoLead }: { contatoId: string; nomeDoLead: string | null }) {
  const conversa = await lerConversa(contatoId)

  if (conversa.mensagens.length === 0) {
    return <p className="py-10 text-center text-xs text-dim">Nenhuma mensagem registrada.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {conversa.cortada && (
        <p className="self-center rounded-xl border border-dashed border-white/[0.14] px-3.5 py-2 text-center font-mono text-[10px] text-[#6b7689]">
          conversa longa — mostrando só as mensagens mais recentes
        </p>
      )}
      {conversa.mensagens.map((mensagem) => {
        const nossa = mensagem.direcao === 'saida'
        return (
          <div key={mensagem.id} className={nossa ? 'flex justify-end' : 'flex justify-start'}>
            <p className={`max-w-[78%] px-3 py-2 text-[12.5px] leading-[1.45] whitespace-pre-wrap ${nossa ? 'rounded-[13px_13px_4px_13px] border border-accent/[0.22] bg-accent/[0.13]' : 'rounded-[13px_13px_13px_4px] border border-white/[0.07] bg-white/[0.055]'}`}>
              {mensagem.texto ?? <span className="italic text-muted">(áudio, imagem ou documento)</span>}
              <span className="ml-2 text-[9.5px] text-dim" title={horaExata(mensagem.ts)}>
                {nossa ? 'bot' : (nomeDoLead ?? 'cliente')} · {quando(mensagem.ts)}
              </span>
            </p>
          </div>
        )
      })}
    </div>
  )
}
