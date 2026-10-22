'use client'

import { useState } from 'react'

/** O botão de copiar o Pix copia e cola, com o aviso de copiado no próprio botão. */
export function CopiarPix({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(codigo)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        } catch {
          // Sem permissão de área de transferência: o código está visível para copiar à mão.
        }
      }}
      className="botao-primario botao-md w-full"
    >
      {copiado ? 'Código copiado' : 'Copiar código Pix'}
    </button>
  )
}
