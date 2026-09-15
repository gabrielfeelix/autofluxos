'use client'

import { useState, useTransition } from 'react'
import { acaoTrazerTodosParaOQuadro } from '@/server/acoes-crm'

/**
 * "Fulano e mais 18 ainda não estão neste funil."
 *
 * A faixa só existe quando há gente de fora, e some sozinha quando não há —
 * aviso permanente vira moldura e para de ser lido.
 *
 * Ela é a resposta para o caso que só aparece em conta viva: o quadro é novo, o
 * inbox tem dezenas de conversas, e o funil abre vazio porque a entrada
 * automática só vale para contato criado depois dele.
 */
export function TrazerTodos({
  clienteId,
  quadroId,
  fora,
}: {
  clienteId: string
  quadroId: string
  fora: number
}) {
  const [resultado, setResultado] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  if (fora === 0 && !resultado) return null

  return (
    <p className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-soft">
      {resultado ?? (
        <>
          <span>
            {fora === 1
              ? '1 contato da sua lista ainda não está neste funil.'
              : `${fora} contatos da sua lista ainda não estão neste funil.`}
          </span>
          <span className="text-dim">
            O funil só recebe sozinho quem chega depois que ele existe.
          </span>
          <button
            type="button"
            disabled={rodando}
            onClick={() =>
              comecar(async () => {
                try {
                  const r = await acaoTrazerTodosParaOQuadro(clienteId, quadroId)
                  if (!r.ok) {
                    setResultado(r.erro ?? 'não deu para trazer')
                    return
                  }
                  setResultado(
                    r.faltaram
                      ? `${r.postos} trazidos. Faltaram ${r.faltaram} — clique de novo.`
                      : `${r.postos} trazidos para a primeira etapa.`,
                  )
                } catch {
                  setResultado('não deu para trazer agora — tente de novo')
                }
              })
            }
            className="app-secondary-button ml-auto px-3 py-1 text-[11.5px] disabled:opacity-50"
          >
            {rodando ? 'trazendo…' : 'Trazer todos'}
          </button>
        </>
      )}
    </p>
  )
}
