'use client'

import { useState } from 'react'
import s from './para-agentes.module.css'

/** O botão que copia o prompt; o texto fica visível e selecionável ao lado. */
export function CopiarPrompt({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      className={s.copiar}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1800)
        } catch {
          // Sem permissão de área de transferência: o texto continua na tela para copiar à mão.
        }
      }}
    >
      {copiado ? 'Copiado' : 'Copiar prompt'}
    </button>
  )
}
