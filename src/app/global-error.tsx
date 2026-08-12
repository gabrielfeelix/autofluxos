'use client'

/**
 * A rede embaixo da rede.
 *
 * O `error.tsx` roda dentro do layout raiz; se quem quebrar for o **próprio**
 * layout, não sobra nada para renderizar o erro. Este arquivo cobre esse caso — e
 * por isso ele traz `html` e `body` próprios, ao contrário de todos os outros.
 *
 * Deve ser raro a ponto de nunca aparecer. Existir é o ponto.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <h1 className="text-lg font-semibold">O painel não conseguiu carregar.</h1>
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Tentar de novo
        </button>
        {error.digest && <p className="text-xs text-zinc-500">código: {error.digest}</p>}
      </body>
    </html>
  )
}
