import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { acharCliente } from '@/server/repos/clientes'
import { acharLead, lerConversa } from '@/server/repos/leads'
import { horaExata, quando } from '../quando'

export const dynamic = 'force-dynamic'

/**
 * Um lead e a conversa inteira dele.
 *
 * A tela é só leitura, e é assim de propósito na Etapa 1: responder acontece no
 * WhatsApp da pessoa, do celular dela. Um campo de resposta aqui prometeria uma
 * caixa de entrada que ainda não existe — e mensagem enviada por um botão que
 * não funciona é pior do que botão nenhum.
 *
 * O lead vem antes de qualquer `<Suspense>` porque é ele que decide se a página
 * existe (ver o comentário na tela de leads sobre status no meio do envio). A
 * conversa, que é a consulta que cresce sem limite, fica atrás da fronteira.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; contatoId: string }>
}) {
  const { clienteId, contatoId } = await params

  const [cliente, lead] = await Promise.all([acharCliente(clienteId), acharLead(clienteId, contatoId)])
  if (!cliente || !lead) notFound()

  const campos = Object.entries(lead.campos)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6 sm:p-10">
      <header>
        <Link
          href={`/clientes/${cliente.id}/leads`}
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← leads de {cliente.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lead.nome ?? 'sem nome'}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          <code className="text-xs">{lead.waId}</code>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <span title={horaExata(lead.criadoEm)}>chegou {quando(lead.criadoEm)}</span>
        </p>
      </header>

      {lead.aguardando && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <strong className="font-semibold">Esperando uma pessoa.</strong> {lead.aguardando.motivo}{' '}
          <span className="text-xs opacity-80" title={horaExata(lead.aguardando.desde)}>
            ({quando(lead.aguardando.desde)})
          </span>
        </p>
      )}

      <section>
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          O que o fluxo coletou
        </h2>

        {campos.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">
            Nada ainda — a conversa não chegou em nenhuma pergunta que salva campo.
          </p>
        ) : (
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {campos.map(([chave, valor]) => (
              <div
                key={chave}
                className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <dt className="text-xs tracking-wide text-zinc-500 uppercase">{chave}</dt>
                <dd className="mt-0.5 text-sm break-words">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">A conversa</h2>
        <Suspense
          fallback={
            <div className="space-y-3">
              <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
              <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
              <span className="sr-only">Carregando a conversa…</span>
            </div>
          }
        >
          <Historico contatoId={contatoId} nomeDoLead={lead.nome} />
        </Suspense>
      </section>
    </main>
  )
}

async function Historico({
  contatoId,
  nomeDoLead,
}: {
  contatoId: string
  nomeDoLead: string | null
}) {
  const conversa = await lerConversa(contatoId)

  if (conversa.mensagens.length === 0) {
    return <p className="text-sm text-zinc-400">Nenhuma mensagem registrada.</p>
  }

  return (
    <>
      {conversa.cortada && (
        <p className="text-center text-[11px] tracking-wide text-zinc-400">
          conversa longa — mostrando só as mensagens mais recentes
        </p>
      )}

      <div className="space-y-3">
        {conversa.mensagens.map((mensagem) => {
          // Quem lê esta tela é o dono do negócio: a resposta dele (o bot)
          // fica à direita, como no WhatsApp dele. O lead fica à esquerda.
          const nossa = mensagem.direcao === 'saida'
          return (
            <div key={mensagem.id} className={nossa ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] ${nossa ? 'text-right' : 'text-left'}`}>
                <p
                  className={
                    nossa
                      ? 'rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-left text-sm whitespace-pre-wrap text-white'
                      : 'rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-zinc-800'
                  }
                >
                  {mensagem.texto ?? (
                    <span className="italic opacity-70">(áudio, imagem ou documento)</span>
                  )}
                </p>
                <span
                  className="mt-1 block text-[11px] text-zinc-400"
                  title={horaExata(mensagem.ts)}
                >
                  {nossa ? 'bot' : (nomeDoLead ?? 'cliente')} · {quando(mensagem.ts)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
