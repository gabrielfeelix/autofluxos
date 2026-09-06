'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarGatilhoDeEvento } from '@/server/acoes'

/**
 * Liga e desliga um gatilho de evento (0044).
 *
 * Gêmeo do `InterruptorDeGatilho`, e separado pelo mesmo motivo das tabelas:
 * são duas coisas que se parecem e não são a mesma. Unificar exigiria um
 * parâmetro "de que tipo é este gatilho?" em toda chamada, que é como um
 * componente vira um `switch`.
 */
export function InterruptorDeEvento({
  clienteId,
  gatilhoId,
  ativo,
}: {
  clienteId: string
  gatilhoId: string
  ativo: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const explicacao = ativo
    ? 'Desligar: o evento continua chegando, mas para de abrir este fluxo.'
    : 'Ligar: o próximo evento com este nome volta a abrir o fluxo.'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? 'Desligar gatilho de evento' : 'Ligar gatilho de evento'}
        disabled={rodando}
        title={explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarGatilhoDeEvento(clienteId, gatilhoId, !ativo)
            if (!r.ok) setErro(r.erro ?? 'não deu para mudar o gatilho')
          })
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
          ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-white/10 bg-white/[0.06]'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativo ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
          }`}
        />
      </button>

      {erro && (
        <span role="alert" className="max-w-[220px] text-right text-[10.5px] leading-4 text-rose-300">
          {erro}
        </span>
      )}
    </span>
  )
}
