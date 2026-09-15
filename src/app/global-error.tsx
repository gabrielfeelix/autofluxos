'use client'

import { DetalheDoErro } from '@/components/design/detalhe-do-erro'

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
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7f9] p-6 text-center font-sans text-[#131922]">
        <span className="flex size-11 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-lg font-bold text-perigo">!</span>
        <h1 className="text-[19px] font-bold">O painel não conseguiu carregar.</h1>
        <button
          onClick={reset}
          className="rounded-[10px] bg-[#2563eb] px-5 py-2.5 text-[13px] font-bold text-white"
        >
          Tentar de novo
        </button>
        <div className="w-full max-w-[430px]">
          <DetalheDoErro erro={error} escuro />
        </div>
      </body>
    </html>
  )
}
