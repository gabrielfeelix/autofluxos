'use client'

import { useState, useTransition } from 'react'

/**
 * Um botão que apaga alguma coisa.
 *
 * Três coisas que ele faz e um `<form action={...}>` cru não fazia:
 *
 * 1. **Pede confirmação**, com o nome do que vai sumir escrito na pergunta.
 * 2. **Mostra o motivo da recusa.** Apagar aqui pode ser negado por regra de
 *    negócio — automação no ar, número com conversa — e sem lugar para o motivo
 *    aparecer o clique parecia não ter funcionado.
 * 3. **Desabilita enquanto roda**, para o clique nervoso não disparar duas vezes.
 */
export function BotaoPerigo({
  acao,
  rotulo = 'Apagar',
  pergunta,
  titulo,
}: {
  acao: () => Promise<{ ok: boolean; erro?: string }>
  rotulo?: string
  /** O que aparece na confirmação. Escreva o nome do alvo aqui. */
  pergunta: string
  titulo?: string
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={rodando}
        title={titulo}
        onClick={() => {
          setErro(null)
          if (!confirm(pergunta)) return
          comecar(async () => {
            const r = await acao()
            if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
          })
        }}
        className="rounded-lg border border-white/[0.09] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:bg-rose-400/[0.09] hover:text-rose-300 disabled:opacity-50"
      >
        {rodando ? '…' : rotulo}
      </button>

      {erro && (
        <span role="alert" className="max-w-[280px] text-right text-[10.5px] leading-4 text-rose-300">
          {erro}
        </span>
      )}
    </span>
  )
}
