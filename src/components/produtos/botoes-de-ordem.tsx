'use client'

import { useState, useTransition } from 'react'
import { acaoMoverProduto } from '@/server/acoes-produtos'

/**
 * Subir e descer um item dentro da categoria, na grade do cardápio.
 *
 * Botão e não arrastar: arrastar é bonito no computador e brigado no celular,
 * que é onde o dono de restaurante mexe no cardápio. Dois botões funcionam
 * igual nos dois, e com teclado. O primeiro não sobe e o último não desce,
 * então os dois ficam desligados em vez de clicar sem efeito.
 */
export function BotoesDeOrdem({
  clienteId,
  produtoId,
  nome,
  primeiro,
  ultimo,
}: {
  clienteId: string
  produtoId: string
  nome: string
  primeiro: boolean
  ultimo: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const mover = (direcao: 'subir' | 'descer') => {
    setErro(null)
    comecar(async () => {
      const r = await acaoMoverProduto(clienteId, produtoId, direcao)
      if (!r.ok) setErro(r.erro ?? 'não deu para mudar a ordem')
    })
  }

  const classe =
    'grid size-7 place-items-center rounded-lg border border-line text-[12px] text-muted transition hover:bg-white/[0.04] hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={rodando || primeiro}
        onClick={() => mover('subir')}
        aria-label={`Subir ${nome}`}
        title="Subir"
        className={classe}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={rodando || ultimo}
        onClick={() => mover('descer')}
        aria-label={`Descer ${nome}`}
        title="Descer"
        className={classe}
      >
        ↓
      </button>
      {erro && (
        <span role="alert" className="text-[10.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
