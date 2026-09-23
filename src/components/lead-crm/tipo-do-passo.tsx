import type { ReactNode } from 'react'

/**
 * O cabeçalho de cada tipo de próximo passo na aba Atividades (8.3).
 *
 * Atividade, mensagem agendada e acompanhamento automático moram na mesma aba
 * porque respondem "o que ainda vai acontecer com esta pessoa", mas quem faz é
 * diferente: uma pessoa da equipe, o sistema na hora marcada, uma sequência.
 * Um acompanhamento parado e uma atividade aberta pareciam o mesmo "próximo
 * passo"; o selo "quem faz" é o que separa um do outro de relance.
 */
export function CabecalhoDoTipo({
  titulo,
  quemFaz,
  descricao,
  contagem,
}: {
  titulo: string
  quemFaz: string
  descricao: ReactNode
  /** O que está pendente deste tipo. Zero não é mostrado. */
  contagem?: number
}) {
  return (
    <header className="border-b border-line px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14.5px] font-bold">{titulo}</h2>
        {contagem ? (
          <span className="rounded-full bg-surface-strong px-1.5 text-[10.5px] text-dim tabular-nums">
            {contagem}
          </span>
        ) : null}
        <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] font-semibold text-muted">
          Quem faz: {quemFaz}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] leading-5 text-dim">{descricao}</p>
    </header>
  )
}
