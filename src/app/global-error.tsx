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
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080b10] p-6 text-center font-sans text-[#e9eef5]">
        <span className="flex size-11 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-lg font-bold text-rose-300">!</span>
        <h1 className="text-[19px] font-bold">O painel não conseguiu carregar.</h1>
        <button
          onClick={reset}
          className="rounded-[10px] bg-[#56d0f5] px-5 py-2.5 text-[13px] font-bold text-[#06222e]"
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
