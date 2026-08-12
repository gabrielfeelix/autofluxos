import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { validar } from '@/core/flow/validar'
import { acaoConectarNumero, acaoCriarFluxo } from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { listarLeads } from '@/server/repos/leads'

export const dynamic = 'force-dynamic'

/**
 * A tela do cliente: fluxos, números conectados e a porta para os leads.
 *
 * O cliente é buscado antes de tudo — é a checagem que decide se a página
 * existe, e ela precisa acontecer antes de qualquer `<Suspense>` para que "não
 * encontrado" responda 404 de verdade em vez de 200 (ver `guides/streaming.md`
 * da versão do Next instalada). O resto, que são três consultas, chega depois.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
            ← todos os clientes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {cliente.iaHabilitada
              ? 'IA habilitada.'
              : 'IA não contratada — Etapa 1, automação pura.'}
          </p>
        </div>

        {/* O fluxo é o meio; o lead é o fim. Fica em destaque, e a contagem —
            principalmente quantos esperam uma pessoa — chega em seguida. */}
        <Link
          href={`/clientes/${cliente.id}/leads`}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700"
        >
          Leads
          <Suspense fallback={<span className="ml-2 text-xs font-normal text-zinc-400">…</span>}>
            <ContagemDeLeads clienteId={cliente.id} />
          </Suspense>
        </Link>
      </header>

      <Suspense fallback={<Esqueleto />}>
        <Conteudo cliente={cliente} />
      </Suspense>
    </main>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ))}
      <span className="sr-only">Carregando os fluxos…</span>
    </div>
  )
}

async function ContagemDeLeads({ clienteId }: { clienteId: string }) {
  const leads = await listarLeads(clienteId)
  const esperando = leads.filter((l) => l.aguardando).length

  return (
    <>
      <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
        {leads.length}
      </span>
      {esperando > 0 && (
        <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          {esperando} esperando
        </span>
      )}
    </>
  )
}

async function Conteudo({ cliente }: { cliente: Cliente }) {
  const [fluxos, canais, cabecalhos] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    headers(),
  ])

  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocolo}://${host}`

  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)
  const conectarComCliente = acaoConectarNumero.bind(null, cliente.id)

  return (
    <>
      <section>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          {fluxos.length === 0
            ? 'Nenhum fluxo ainda.'
            : `${fluxos.length} ${fluxos.length === 1 ? 'fluxo' : 'fluxos'}.`}
        </p>

        <ul className="space-y-2">
          {fluxos.map((fluxo) => {
            const validacao = validar(fluxo.rascunho)
            return (
              <li key={fluxo.id}>
                <Link
                  href={`/clientes/${cliente.id}/fluxos/${fluxo.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span>
                    <span className="font-medium">{fluxo.nome}</span>
                    <span className="ml-2 text-xs text-zinc-400">
                      {fluxo.rascunho.nodes.length} blocos
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!validacao.ok && (
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                        {validacao.erros.length} erro(s)
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        fluxo.versaoPublicadaId
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {fluxo.versaoPublicadaId ? 'no ar' : 'rascunho'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Números do WhatsApp
        </h2>

        {canais.length > 0 && (
          <ul className="mt-3 space-y-2">
            {canais.map((canal) => {
              const fluxo = fluxos.find((f) => f.id === canal.flowId)
              return (
                <li
                  key={canal.id}
                  className="rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
                >
                  <code className="text-xs">{canal.phoneNumberId}</code>
                  <span className="ml-2 text-xs text-zinc-500">
                    {fluxo
                      ? fluxo.versaoPublicadaId
                        ? `roda "${fluxo.nome}"`
                        : `ligado a "${fluxo.nome}", que ainda não foi publicado`
                      : 'sem fluxo ligado — o bot não responde'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <form action={conectarComCliente} className="mt-3 flex flex-wrap gap-2">
          <input
            name="phoneNumberId"
            required
            placeholder="Identificação do número (Meta)"
            className="min-w-48 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
          <select
            name="flowId"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">sem fluxo</option>
            {fluxos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Conectar
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          No painel da Meta, em <strong>WhatsApp → Configuração</strong>, aponte o webhook para{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
            {baseUrl}/api/webhook/whatsapp
          </code>{' '}
          e assine o campo <code>messages</code>.
        </p>
      </section>

      <form
        action={criarComCliente}
        className="flex gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <input
          name="nome"
          required
          placeholder="Nome do novo fluxo"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Novo fluxo
        </button>
      </form>
    </>
  )
}
