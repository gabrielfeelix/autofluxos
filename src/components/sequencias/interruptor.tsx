'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarSequencia } from '@/server/acoes'

/**
 * Liga e desliga uma sequência.
 *
 * Mesma forma do interruptor de gatilho e do de campanha, e a repetição é
 * deliberada: as três coisas ligam e desligam do mesmo jeito na mesma tela, e
 * inventar um controle diferente para cada uma seria fazer a pessoa aprender
 * três vezes o mesmo gesto.
 *
 * **Desligar não esvazia.** Quem já está dentro continua dentro, e é o executor
 * do passo que encerra a inscrição ao encontrar a sequência desligada. Esvaziar
 * aqui apagaria o histórico de quem já tinha recebido metade — e desligar quase
 * sempre significa "pausa", não "cancela".
 */
export function InterruptorDeSequencia({
  clienteId,
  sequenciaId,
  ativa,
}: {
  clienteId: string
  sequenciaId: string
  ativa: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativa}
        aria-label={ativa ? 'Desligar sequência' : 'Ligar sequência'}
        disabled={rodando}
        title={
          ativa
            ? 'Desligar: para de inscrever gente nova, e quem está dentro encerra no próximo passo.'
            : 'Ligar: volta a inscrever a partir do próximo evento.'
        }
        onClick={() => {
          setErro(null)
          comecar(async () => {
            try {
              const r = await acaoAlternarSequencia(clienteId, sequenciaId, !ativa)
              if (!r.ok) setErro(r.erro ?? 'não deu para mudar a sequência')
            } catch {
              setErro('não deu para mudar agora')
            }
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
