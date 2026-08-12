import Link from 'next/link'

/**
 * Endereço que não existe.
 *
 * Vale mais do que parece: os endereços do painel carregam id de cliente e de
 * fluxo, então "não encontrado" quase nunca é erro de digitação — é link velho
 * de algo que foi apagado. Dizer isso poupa a pessoa de procurar o que não
 * existe mais.
 */
export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Não achei esta página.</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        O endereço pode estar errado, ou apontar para algo que foi apagado.
      </p>
      <Link
        href="/"
        className="mx-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Voltar para os clientes
      </Link>
    </main>
  )
}
