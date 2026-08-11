import Link from 'next/link'
import { notFound } from 'next/navigation'
import { validar } from '@/core/flow/validar'
import { acaoCriarFluxo } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarFluxos } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const fluxos = await listarFluxos(clienteId)
  const criarComCliente = acaoCriarFluxo.bind(null, clienteId)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
          ← todos os clientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cliente.nome}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {fluxos.length === 0
            ? 'Nenhum fluxo ainda.'
            : `${fluxos.length} ${fluxos.length === 1 ? 'fluxo' : 'fluxos'}.`}{' '}
          {cliente.iaHabilitada ? 'IA habilitada.' : 'IA não contratada — Etapa 1, automação pura.'}
        </p>
      </header>

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
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    validacao.ok
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/15 text-red-700 dark:text-red-400'
                  }`}
                >
                  {validacao.ok ? 'pode publicar' : `${validacao.erros.length} erro(s)`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

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
    </main>
  )
}
