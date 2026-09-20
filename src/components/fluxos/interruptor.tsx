'use client'

import { useState, useTransition } from 'react'
import { acaoAlternarFluxoAtivo } from '@/server/acoes'

/**
 * Liga e desliga uma automação inteira.
 *
 * **É o gesto que faltava entre publicar e apagar.** Quem queria parar um fluxo
 * por uns dias — a campanha acabou, o desenho vai ser trocado, o cliente pediu
 * para segurar — só tinha dois caminhos, e os dois erravam: apagar leva o
 * histórico junto, e desligar o número cala também o que devia continuar
 * falando.
 *
 * Desligado quer dizer **não abre conversa nova**. Quem já está conversando
 * termina o fluxo: cortar no meio de uma pergunta deixaria a pessoa falando
 * sozinha no WhatsApp, e quem desligou queria parar de captar, não abandonar.
 *
 * Componente de cliente porque a ação devolve motivo de recusa, e um `<form>`
 * cru jogaria isso fora — o clique pareceria não ter funcionado.
 */
export function InterruptorDeFluxo({
  clienteId,
  fluxoId,
  ativo,
  nome,
  emAndamento = 0,
}: {
  clienteId: string
  fluxoId: string
  ativo: boolean
  nome: string
  /**
   * Quantas conversas estão rodando este fluxo agora (RB-44).
   *
   * O padrão é zero, que quer dizer "não perguntei" **e** "nenhuma", e aqui as
   * duas levam ao mesmo texto: sem número, a frase não menciona conversa. É
   * melhor ficar calado do que dizer "0 conversas serão afetadas" quando a
   * leitura não aconteceu.
   */
  emAndamento?: number
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  /*
   * A frase diz o que acontece com quem **já está** conversando, e é a RB-44:
   * "pausar impede novas sessões e, por padrão, permite concluir as ativas".
   *
   * Dizer o número muda a decisão de quem lê. "Para de abrir conversa nova" é
   * abstrato; "as 3 conversas em andamento terminam o roteiro" responde a
   * pergunta que a pessoa tem na mão, que é se ela vai deixar alguém falando
   * sozinho no WhatsApp.
   */
  const conversas =
    emAndamento === 1 ? '1 conversa em andamento termina' : `as ${emAndamento} conversas em andamento terminam`

  const explicacao = ativo
    ? `Desligar “${nome}”: para de abrir conversa nova. ${
        emAndamento > 0 ? `${conversas} o roteiro normalmente` : 'Quem já está conversando termina'
      }, e a versão no ar continua publicada.`
    : `Ligar “${nome}”: volta a abrir conversa na próxima mensagem. Não precisa publicar de novo.`

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? `Desligar a automação ${nome}` : `Ligar a automação ${nome}`}
        disabled={rodando}
        title={explicacao}
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoAlternarFluxoAtivo(clienteId, fluxoId, !ativo)
            if (!r.ok) setErro(r.erro ?? 'não deu para ligar/desligar')
          })
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:opacity-50 ${
          ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ativo ? 'left-[15px] bg-emerald-300' : 'left-[2px] bg-dim'
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
