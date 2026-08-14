import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { CaixaDeResposta } from '@/components/lead/responder'
import { acaoEncerrarAtendimento, acaoResponderLead } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { contextoDeResposta } from '@/server/repos/conversas'
import { listarLeads, lerConversa, type Lead, type MensagemDoLead } from '@/server/repos/leads'
import { listarRespostasRapidas, type RespostaRapida } from '@/server/repos/respostas-rapidas'
import { horaExata, quando } from '../leads/quando'

export const dynamic = 'force-dynamic'

type Busca = { conversa?: string | string[] }

/**
 * A tela de trabalho de quem atende.
 *
 * Leads continua sendo a lista de qualificação e relatório; Inbox é a fila
 * para responder sem voltar para uma tabela a cada conversa. A seleção vive na
 * URL para cada conversa poder ser compartilhada ou retomada ao voltar, mas o
 * Link do Next troca apenas o payload da rota — não há recarregamento do
 * navegador.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Busca>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const [cliente, leads, respostasRapidas] = await Promise.all([
    acharCliente(clienteId),
    listarLeads(clienteId),
    listarRespostasRapidas(clienteId),
  ])
  if (!cliente) notFound()

  const pedido = Array.isArray(busca.conversa) ? busca.conversa[0] : busca.conversa
  const selecionado = escolherLead(leads, pedido)

  return (
    <ClienteShell cliente={cliente} ativa="inbox">
      <main className="px-[42px] pt-[26px] pb-[42px]">
        {leads.length === 0 || !selecionado ? (
          <EstadoVazio clienteId={cliente.id} />
        ) : (
          <Conteudo
            clienteId={cliente.id}
            leads={leads}
            selecionado={selecionado}
            respostasRapidas={respostasRapidas}
          />
        )}
      </main>
    </ClienteShell>
  )
}

function escolherLead(leads: Lead[], contatoId: string | undefined): Lead | null {
  if (leads.length === 0) return null
  return (
    leads.find((lead) => lead.contatoId === contatoId) ??
    leads.find((lead) => lead.aguardando !== null) ??
    leads[0] ??
    null
  )
}

function EstadoVazio({ clienteId }: { clienteId: string }) {
  return (
    <section className="mx-auto mt-16 max-w-[440px] text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.035] text-xl">
        ◌
      </span>
      <p className="mt-5 font-mono text-[10px] font-bold tracking-[0.16em] text-dim">INBOX VAZIO</p>
      <h2 className="mt-2 text-[18px] font-bold tracking-[-0.02em]">Nenhuma conversa para atender</h2>
      <p className="mt-2 text-[13px] leading-6 text-muted">
        Quando alguém falar com o número ligado ao bot, a conversa aparece aqui. A tela de Leads
        continua sendo o lugar para analisar todos os contatos.
      </p>
      <Link href={`/clientes/${clienteId}/leads`} className="app-secondary-button mt-5 inline-block px-4 py-2.5 text-[12.5px]">
        Ver Leads
      </Link>
    </section>
  )
}

async function Conteudo({
  clienteId,
  leads,
  selecionado,
  respostasRapidas,
}: {
  clienteId: string
  leads: Lead[]
  selecionado: Lead
  respostasRapidas: RespostaRapida[]
}) {
  // `selecionado` veio de `listarLeads(clienteId)`. Só depois desse vínculo
  // cliente–contato confirmado é seguro ler as mensagens pelo id do contato.
  const [conversa, contexto] = await Promise.all([
    lerConversa(selecionado.contatoId),
    contextoDeResposta(clienteId, selecionado.contatoId),
  ])
  const restante = restaDaJanela(contexto?.ultimaEntradaEm ?? null)
  const janela = restante && restante > 0 ? comoFalta(restante) : null
  const primeiroNome = selecionado.nome?.split(' ')[0] ?? 'esta pessoa'
  const esperando = leads.filter((lead) => lead.aguardando).length

  return (
    <div className="grid min-h-[640px] grid-cols-[292px_minmax(390px,1fr)_250px] overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#0c1118] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <Fila clienteId={clienteId} leads={leads} selecionado={selecionado} esperando={esperando} />

      <section className="flex min-w-0 flex-col border-r border-white/[0.06]">
        <CabecalhoDaConversa clienteId={clienteId} lead={selecionado} />
        <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(500px_320px_at_70%_5%,rgba(86,208,245,0.04),transparent_68%)] p-5">
          <Historico mensagens={conversa.mensagens} cortada={conversa.cortada} nome={selecionado.nome} />
        </div>
        <CaixaDeResposta
          acao={acaoResponderLead.bind(null, clienteId, selecionado.contatoId)}
          restaDaJanela={janela}
          nome={primeiroNome}
          respostasRapidas={respostasRapidas}
        />
      </section>

      <DadosDoLead clienteId={clienteId} lead={selecionado} />
    </div>
  )
}

function Fila({
  clienteId,
  leads,
  selecionado,
  esperando,
}: {
  clienteId: string
  leads: Lead[]
  selecionado: Lead
  esperando: number
}) {
  return (
    <aside className="min-w-0 border-r border-white/[0.06] bg-white/[0.015]">
      <header className="border-b border-white/[0.06] px-4 py-[17px]">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[14px] font-bold tracking-[-0.01em]">Inbox</h2>
          <span className="rounded-full border border-white/[0.09] bg-white/[0.035] px-2 py-0.5 font-mono text-[10px] text-muted">
            {leads.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-dim">
          {esperando > 0 ? `${esperando} esperando uma pessoa` : 'Todas as conversas estão com o bot'}
        </p>
      </header>

      <nav aria-label="Conversas" className="max-h-[calc(100vh-264px)] overflow-y-auto py-1.5">
        {leads.map((lead) => {
          const ativa = lead.contatoId === selecionado.contatoId
          const nome = lead.nome ?? 'sem nome'
          return (
            <Link
              key={lead.contatoId}
              href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(lead.contatoId)}`}
              aria-current={ativa ? 'page' : undefined}
              scroll={false}
              className={`group mx-1.5 mb-0.5 flex gap-2.5 rounded-[10px] px-2.5 py-3 transition ${
                ativa ? 'bg-accent/[0.12]' : 'hover:bg-white/[0.045]'
              }`}
            >
              <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <strong className={`min-w-0 flex-1 truncate text-[12.5px] ${ativa ? 'text-white' : 'text-soft'}`}>{nome}</strong>
                  <small className="shrink-0 text-[9.5px] text-dim">{lead.ultimaEm ? quando(lead.ultimaEm) : ''}</small>
                </span>
                <span className={`mt-0.5 block truncate text-[10.5px] ${lead.aguardando ? 'text-rose-300' : 'text-dim'}`}>
                  {lead.aguardando ? `Pessoa: ${lead.aguardando.motivo}` : resumoDaConversa(lead)}
                </span>
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function CabecalhoDaConversa({ clienteId, lead }: { clienteId: string; lead: Lead }) {
  const nome = lead.nome ?? 'sem nome'
  return (
    <header className="flex min-h-[69px] items-center gap-3 border-b border-white/[0.06] px-5">
      <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13px] font-bold">{nome}</h2>
        <p className="mt-0.5 font-mono text-[10px] text-dim">{lead.waId}</p>
      </div>
      <Link
        href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
        className="rounded-[8px] border border-white/[0.09] px-2.5 py-1.5 text-[10.5px] font-semibold text-muted transition hover:border-white/[0.18] hover:text-white"
      >
        Abrir ficha
      </Link>
    </header>
  )
}

function Historico({
  mensagens,
  cortada,
  nome,
}: {
  mensagens: MensagemDoLead[]
  cortada: boolean
  nome: string | null
}) {
  if (mensagens.length === 0) {
    return <p className="py-16 text-center text-[12px] text-dim">Nenhuma mensagem registrada.</p>
  }

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-2.5">
      {cortada && (
        <p className="mb-1 self-center rounded-full border border-dashed border-white/[0.15] px-3 py-1.5 text-center font-mono text-[9.5px] text-dim">
          mostrando as 500 mensagens mais recentes
        </p>
      )}
      {mensagens.map((mensagem) => {
        const nossa = mensagem.direcao === 'saida'
        return (
          <div key={mensagem.id} className={nossa ? 'flex justify-end' : 'flex justify-start'}>
            <p className={`max-w-[78%] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap shadow-[0_1px_1px_rgba(0,0,0,0.12)] ${
              nossa
                ? 'rounded-[13px_13px_4px_13px] border border-accent/[0.2] bg-accent/[0.12]'
                : 'rounded-[13px_13px_13px_4px] border border-white/[0.07] bg-white/[0.055]'
            }`}>
              {mensagem.texto ?? <span className="italic text-muted">(áudio, imagem ou documento)</span>}
              <span className="ml-2 text-[9.5px] text-dim" title={horaExata(mensagem.ts)}>
                {nossa ? 'atendimento' : (nome ?? 'cliente')} · {quando(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[9.5px] text-amber-200">envio não confirmado</span>
              )}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function DadosDoLead({ clienteId, lead }: { clienteId: string; lead: Lead }) {
  const campos = Object.entries(lead.campos)
  return (
    <aside className="min-w-0 bg-white/[0.012]">
      <header className="border-b border-white/[0.06] px-4 py-[17px]">
        <p className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-dim">CONTATO</p>
        <h2 className="mt-1 text-[13px] font-bold">Contexto do lead</h2>
      </header>

      <div className="p-4">
        <div className={`rounded-[11px] border px-3 py-2.5 ${lead.aguardando ? 'border-rose-400/25 bg-rose-400/[0.07]' : 'border-emerald-400/20 bg-emerald-400/[0.055]'}`}>
          <p className={`text-[10px] font-bold tracking-[0.04em] ${lead.aguardando ? 'text-rose-300' : 'text-emerald-300'}`}>
            {lead.aguardando ? 'AGUARDANDO PESSOA' : 'BOT RESPONDENDO'}
          </p>
          {lead.aguardando ? (
            <>
              <p className="mt-1 text-[11px] leading-4 text-muted">{lead.aguardando.motivo}</p>
              <form action={acaoEncerrarAtendimento.bind(null, clienteId, lead.contatoId)}>
                <button
                  type="submit"
                  className="mt-2.5 w-full rounded-[8px] border border-rose-400/30 bg-rose-400/[0.11] px-2.5 py-2 text-[11px] font-bold text-rose-200 transition hover:bg-rose-400/[0.18]"
                >
                  Já atendi
                </button>
              </form>
            </>
          ) : (
            <p className="mt-1 text-[11px] leading-4 text-muted">O bot responde enquanto a conversa estiver ativa.</p>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-soft">O que o fluxo coletou</h3>
            <Link href={`/clientes/${clienteId}/leads/${lead.contatoId}`} className="text-[10.5px] font-semibold text-accent hover:underline">
              Ficha
            </Link>
          </div>
          {campos.length === 0 ? (
            <p className="mt-2 text-[11px] leading-5 text-dim">Ainda não houve campo preenchido nesta conversa.</p>
          ) : (
            <dl className="mt-2.5 divide-y divide-white/[0.045] border-y border-white/[0.045]">
              {campos.map(([chave, valor]) => (
                <div key={chave} className="py-2.5">
                  <dt className="font-mono text-[9.5px] text-dim">{chave}</dt>
                  <dd className="mt-0.5 break-words text-[11.5px] font-semibold text-soft">{valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </aside>
  )
}

function Avatar({ nome, alerta }: { nome: string | null; alerta: boolean }) {
  const iniciais = (nome ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.05] text-[10px] font-bold text-[#b9c2d0]">
      {iniciais}
      {alerta && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#0c1118] bg-rose-400" />}
    </span>
  )
}

function resumoDaConversa(lead: Lead): string {
  if (!lead.ultimoTexto) return lead.ultimaEm ? 'mídia ou mensagem sem texto' : 'sem mensagem'
  const prefixo = lead.ultimaDirecao === 'saida' ? 'atendimento: ' : ''
  return `${prefixo}${lead.ultimoTexto}`
}
