'use client'

import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { acaoAlternarGatilho } from '@/server/acoes'

/**
 * Liga e desliga uma palavra-chave.
 *
 * Desligar em vez de apagar é o caminho normal: a contagem de execuções é o
 * histórico do gatilho, e apagar para "testar sem ele" joga fora justamente o
 * número que responderia se vale a pena mantê-lo.
 *
 * Componente de cliente pelo mesmo motivo de `ControleDeAutomacao`: a ação
 * devolve motivo de recusa, e um `<form>` cru jogaria isso fora, o clique
 * pareceria não ter funcionado.
 */
export function InterruptorDeGatilho({
  clienteId,
  gatilhoId,
  ativo: doServidor,
  bloqueio = null,
}: {
  clienteId: string
  gatilhoId: string
  ativo: boolean
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
  const [ativo, setAtual] = useState(doServidor)

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
        disabled={(!ativo && bloqueio !== null)}
        title={bloqueio ?? explicacao}
        onClick={() => {
          setErro(null)
          const antes = ativo
          setAtual(!antes)
          depoisDaTela(() => acaoAlternarGatilho(clienteId, gatilhoId, !antes)).then(
            (r) => {
              if (!r.ok) {
                setAtual(antes)
                setErro(r.erro ?? 'não deu para mudar o gatilho')
              }
            },
            () => {
              setAtual(antes)
              setErro('não deu para mudar agora')
            },
          )
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ativo && bloqueio !== null
            ? 'border-amber-300/40 bg-amber-300/20'
            : ativo
              ? 'border-emerald-400/40 bg-emerald-400/25'
              : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativo ? `left-[15px] ${bloqueio !== null ? 'bg-amber-300' : 'bg-emerald-300'}` : 'left-[2px] bg-dim'
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
