'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Deu errado.
 *
 * Sem este arquivo, uma falha de banco derruba a árvore inteira e a pessoa fica
 * com a tela branca do Next, sem caminho de volta. Aqui ela tem duas saídas:
 * tentar de novo (`reset` refaz só o pedaço que quebrou) e voltar para o começo.
 *
 * O `digest` aparece porque em produção a mensagem real fica no servidor, de
 * propósito — mensagem de erro de banco costuma vazar nome de tabela e coluna.
 * O digest é o que liga o que a pessoa vê ao que está no log da Vercel.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Vai para o log do servidor na Vercel, onde dá para procurar pelo digest.
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Alguma coisa quebrou aqui.</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Nada do que você fez se perdeu — o rascunho do fluxo é salvo sozinho. Tentar de novo costuma
        resolver quando é falha de rede.
      </p>

      <div className="flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Voltar para os clientes
        </Link>
      </div>

      {error.digest && (
        <p className="text-xs text-zinc-400">
          Se precisar reportar, mande este código: <code>{error.digest}</code>
        </p>
      )}
    </main>
  )
}
