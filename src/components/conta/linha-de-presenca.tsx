'use client'

import { Interruptor } from '@/components/design/interruptor'
import { trocarPresenca, usePresenca } from './presenca'

/**
 * Disponível para atender, como interruptor.
 *
 * Muda na tela no clique e grava por trás (`presenca.ts`). Ligado é
 * "disponível": é o estado em que a pessoa recebe conversa, e o interruptor
 * aceso diz isso sem precisar ler a palavra.
 */
export function LinhaDePresenca({ doServidor }: { doServidor: string | null }) {
  const presenca = usePresenca(doServidor)
  if (!presenca) return null
  const disponivel = presenca === 'disponivel'

  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-surface">
      <span aria-hidden className={`size-2 shrink-0 rounded-full transition-colors ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-soft">{disponivel ? 'Disponível' : 'Ausente'}</span>
        <span className="block text-[11px] text-dim">{disponivel ? 'Recebe conversa nova' : 'Não entra na distribuição'}</span>
      </span>
      <Interruptor
        marcada={disponivel}
        aoMudar={(ligada) => void trocarPresenca(ligada ? 'disponivel' : 'ausente', presenca)}
        rotuloAcessivel="Disponível para atender"
      />
    </label>
  )
}
