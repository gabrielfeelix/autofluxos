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
    <main className="flex min-h-screen items-center justify-center p-10 text-center">
      <div className="app-page-enter max-w-[430px]">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-lg font-bold text-rose-300">!</span>
      <h1 className="text-[19px] font-bold">Alguma coisa quebrou aqui.</h1>
      <p className="mt-2 mb-5 text-[12.5px] leading-[1.65] text-muted">
        Nada do que você fez se perdeu — o rascunho do fluxo é salvo sozinho. Tentar de novo costuma
        resolver quando é falha de rede.
      </p>

      <div className="flex justify-center gap-2">
        <button
          onClick={reset}
          className="app-primary-button px-5 py-2.5 text-[13px]"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="app-secondary-button px-5 py-2.5 text-[13px]"
        >
          Voltar para os clientes
        </Link>
      </div>

      {error.digest && (
        <p className="mt-4 text-xs text-dim">
          Se precisar reportar, mande este código: <code>{error.digest}</code>
        </p>
      )}
      </div>
    </main>
  )
}
