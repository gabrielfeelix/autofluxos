'use client'

import { useActionState } from 'react'

/**
 * O botão que faz alguém **virar** atendente.
 *
 * Até aqui a conversa ia para `humano` e ficava esperando "uma pessoa" — que,
 * com mais de uma no time, é o mesmo que esperar ninguém. Assumir põe um nome
 * ali, e o nome é o que faz alguém voltar depois.
 *
 * **Não avisa a pessoa do outro lado**, e isso é decisão: assumir é organização
 * interna, e anunciar no WhatsApp que "a Ana assumiu" expõe a nossa mesa para
 * quem só quer ser respondido.
 */
type Estado = { erro?: string }

export function Assumir({
  assumir,
  liberar,
  responsavel,
  souEu,
}: {
  assumir: () => Promise<{ ok: boolean; erro?: string }>
  liberar: () => Promise<{ ok: boolean; erro?: string }>
  /** Nome de quem já assumiu. `null` = ninguém. */
  responsavel: string | null
  souEu: boolean
}) {
  const [estado, agir, pendente] = useActionState<Estado, FormData>(async (_anterior, formData) => {
    const r = formData.get('acao') === 'liberar' ? await liberar() : await assumir()
    return { erro: r.ok ? undefined : r.erro }
  }, {})

  return (
    <form action={agir} className="flex shrink-0 items-center gap-2">
      {responsavel && (
        <span className="max-w-[140px] truncate text-[10.5px] text-dim">
          {souEu ? 'você está atendendo' : `com ${responsavel}`}
        </span>
      )}

      {/*
        Quem já assumiu vê "Liberar"; quem não assumiu vê "Assumir" — inclusive
        quando outra pessoa já está com a conversa. Bloquear a tomada seria pior:
        gente sai de férias no meio de um atendimento, e o caminho de destravar
        não pode ser pedir para alguém voltar do almoço.
      */}
      <input type="hidden" name="acao" value={souEu ? 'liberar' : 'assumir'} />
      <button
        type="submit"
        disabled={pendente}
        className="rounded-[8px] border border-white/[0.09] px-2.5 py-1.5 text-[10.5px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
      >
        {pendente ? '…' : souEu ? 'Liberar' : responsavel ? 'Assumir mesmo assim' : 'Assumir'}
      </button>

      {estado.erro && (
        <span role="alert" className="max-w-[180px] text-[10.5px] leading-4 text-rose-300">
          {estado.erro}
        </span>
      )}
    </form>
  )
}
