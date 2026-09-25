'use client'

import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
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
 * aqui apagaria o histórico de quem já tinha recebido metade, e desligar quase
 * sempre significa "pausa", não "cancela".
 */
export function InterruptorDeSequencia({
  clienteId,
  sequenciaId,
  ativa: doServidor,
}: {
  clienteId: string
  sequenciaId: string
  ativa: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  /*
   * Otimista desde 25/set: o interruptor vira no clique e volta, com o motivo,
   * se o servidor recusar. Antes ele esperava a página voltar do servidor.
   */
  const [ativa, setAtual] = useState(doServidor)

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativa}
        aria-label={ativa ? 'Desligar sequência' : 'Ligar sequência'}
        title={
          ativa
            ? 'Desligar: para de inscrever gente nova, e quem está dentro encerra no próximo passo.'
            : 'Ligar: volta a inscrever a partir do próximo evento.'
        }
        onClick={() => {
          setErro(null)
          const antes = ativa
          setAtual(!antes)
          depoisDaTela(() => acaoAlternarSequencia(clienteId, sequenciaId, !antes)).then(
            (r) => {
              if (!r.ok) {
                setAtual(antes)
                setErro(r.erro ?? 'não deu para mudar a sequência')
              }
            },
            () => {
              setAtual(antes)
              setErro('não deu para mudar agora')
            },
          )
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
          ativa ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativa ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
          }`}
        />
      </button>

      {erro && (
        <span role="alert" className="max-w-[220px] text-right text-[10.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
