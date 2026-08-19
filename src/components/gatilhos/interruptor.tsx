'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarGatilho } from '@/server/acoes'

/**
 * Liga e desliga uma palavra-chave.
 *
 * Desligar em vez de apagar é o caminho normal: a contagem de execuções é o
 * histórico do gatilho, e apagar para "testar sem ele" joga fora justamente o
 * número que responderia se vale a pena mantê-lo.
 *
 * Componente de cliente pelo mesmo motivo de `ControleDeAutomacao`: a ação
 * devolve motivo de recusa, e um `<form>` cru jogaria isso fora — o clique
 * pareceria não ter funcionado.
 */
export function InterruptorDeGatilho({
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
    ? 'Desligar: a frase para de abrir este fluxo, e a contagem fica.'
    : 'Ligar: a frase volta a abrir este fluxo na próxima mensagem.'

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? 'Desligar gatilho' : 'Ligar gatilho'}
        disabled={rodando}
        title={explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarGatilho(clienteId, gatilhoId, !ativo)
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
