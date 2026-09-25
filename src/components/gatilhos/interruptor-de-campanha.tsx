'use client'

import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { acaoAlternarCampanha } from '@/server/acoes'

/**
 * Liga e desliga uma campanha.
 *
 * Gêmeo de `InterruptorDeGatilho`, e separado dele porque a ação é outra, não
 * porque o desenho é. Unificar os dois num componente que recebe a ação por
 * parâmetro atravessaria a fronteira de Server Action com uma função vinda do
 * cliente, que é justamente o que o React recusa.
 */
export function InterruptorDeCampanha({
  clienteId,
  campanhaId,
  ativa: doServidor,
  bloqueio = null,
}: {
  clienteId: string
  campanhaId: string
  ativa: boolean
  /**
   * Por que não dá para ligar, quando não dá (A05): o destino não tem versão
   * publicada. Desligado, o interruptor trava e o motivo vira o `title`; ligado
   * (entrada antiga, de antes da regra), fica âmbar, porque verde diria que
   * atende. O servidor recusa do mesmo jeito: isto é só a tela contando antes.
   */
  bloqueio?: string | null
}) {
  const [erro, setErro] = useState<string | null>(null)
  /*
   * Otimista desde 25/set: o interruptor vira no clique e volta, com o motivo,
   * se o servidor recusar. Antes ele esperava a página voltar do servidor.
   */
  const [ativa, setAtual] = useState(doServidor)

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
        disabled={(!ativa && bloqueio !== null)}
        title={bloqueio ?? explicacao}
        onClick={() => {
          setErro(null)
          const antes = ativa
          setAtual(!antes)
          depoisDaTela(() => acaoAlternarCampanha(clienteId, campanhaId, !antes)).then(
            (r) => {
              if (!r.ok) {
                setAtual(antes)
                setErro(r.erro ?? 'não deu para mudar a campanha')
              }
            },
            () => {
              setAtual(antes)
              setErro('não deu para mudar agora')
            },
          )
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ativa && bloqueio !== null
            ? 'border-amber-300/40 bg-amber-300/20'
            : ativa
              ? 'border-emerald-400/40 bg-emerald-400/25'
              : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativa ? `left-[15px] ${bloqueio !== null ? 'bg-amber-300' : 'bg-emerald-300'}` : 'left-[2px] bg-dim'
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
