'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarCampanha } from '@/server/acoes'

/**
 * Liga e desliga uma campanha.
 *
 * Gêmeo de `InterruptorDeGatilho`, e separado dele porque a ação é outra — não
 * porque o desenho é. Unificar os dois num componente que recebe a ação por
 * parâmetro atravessaria a fronteira de Server Action com uma função vinda do
 * cliente, que é justamente o que o React recusa.
 */
export function InterruptorDeCampanha({
  clienteId,
  campanhaId,
  ativa,
}: {
  clienteId: string
  campanhaId: string
  ativa: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const explicacao = ativa
    ? 'Desligar: a frase para de abrir este fluxo. A contagem fica.'
    : 'Ligar: a frase volta a abrir este fluxo na próxima mensagem.'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativa}
        aria-label={ativa ? 'Desligar campanha' : 'Ligar campanha'}
        disabled={rodando}
        title={explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarCampanha(clienteId, campanhaId, !ativa)
            if (!r.ok) setErro(r.erro ?? 'não deu para mudar a campanha')
          })
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
          ativa ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-white/10 bg-white/[0.06]'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativa ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
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
