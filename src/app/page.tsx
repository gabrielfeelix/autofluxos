import Link from 'next/link'
import { acaoCriarCliente, acaoCriarExemplo } from '@/server/acoes'
import { listarClientes } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

export default async function Pagina() {
  const clientes = await listarClientes()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cada cliente tem os fluxos dele. O que é específico de um negócio mora no fluxo, nunca no
          código.
        </p>
      </header>

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum cliente ainda.</p>
          <form action={acaoCriarExemplo} className="mt-4">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Criar um cliente de exemplo
            </button>
          </form>
          <p className="mt-3 text-xs text-zinc-400">
            Vem com um fluxo de triagem pronto, para você ter o que testar.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="font-medium">{cliente.nome}</span>
                <span className="text-xs text-zinc-400">
                  {cliente.iaHabilitada ? 'com IA' : 'sem IA'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={acaoCriarCliente} className="flex gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <input
          name="nome"
          required
          placeholder="Nome do novo cliente"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Adicionar
        </button>
      </form>
    </main>
  )
}
