'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { acaoCancelarAgendada } from '@/server/acoes-agendamento'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'

/**
 * "N agendadas" na barra de filtros, e a lista inteira da conta ao clicar.
 *
 * ---------------------------------------------------------------------------
 * Por que por conta e não por conversa
 * ---------------------------------------------------------------------------
 *
 * O painel de agendar, dentro da conversa, lista o que é daquele contato, e é
 * o suficiente enquanto se está atendendo alguém. A pergunta que ele não
 * responde é a que o dono fez: **quantas temos no total?**
 *
 * Ela importa porque mensagem marcada some da vista. Ninguém vai abrir conversa
 * por conversa para conferir o que o sistema vai mandar amanhã, e uma promessa
 * que ninguém consegue revisar é uma promessa que o produto não deveria fazer.
 * O número fica ao lado de "N esperando uma pessoa" porque as duas linhas
 * respondem à mesma pergunta: o que ainda está em aberto nesta conta.
 *
 * Some quando é zero, como a linha ao lado: um "0 agendadas" permanente é ruído
 * para a conta que não usa o recurso.
 */
export function ContadorDeAgendadas({
  clienteId,
  quantas,
  lista,
}: {
  clienteId: string
  quantas: number
  lista: (MensagemAgendada & { nomeDoContato: string | null })[]
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoClicar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [aberto])

  if (quantas === 0) return null

  const falharam = lista.filter((a) => a.estado === 'falhou').length

  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
          falharam > 0
            ? 'border-rose-400/30 bg-rose-400/[0.09] text-perigo'
            : 'border-line bg-surface text-soft hover:border-primary/40 hover:text-primary'
        }`}
      >
        {quantas} agendada{quantas === 1 ? '' : 's'}
        {falharam > 0 && ` · ${falharam} falhou`}
      </button>

      {aberto && (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-[340px] overflow-hidden rounded-[12px] border border-line bg-panel shadow-menu">
          <p className="border-b border-line px-3 py-2 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">
            Mensagens agendadas
          </p>
          <ul className="max-h-[320px] overflow-y-auto">
            {lista.map((a) => (
              <Linha key={a.id} clienteId={clienteId} agendada={a} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Linha({
  clienteId,
  agendada,
}: {
  clienteId: string
  agendada: MensagemAgendada & { nomeDoContato: string | null }
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()
  const falhou = agendada.estado === 'falhou'

  return (
    <li className="border-b border-line-soft px-3 py-2 last:border-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-bold text-ink">
            {agendada.nomeDoContato ?? 'sem nome'}
            <span className="ml-1.5 font-normal text-dim tabular-nums">
              {quandoLegivel(agendada.quando)}
            </span>
          </p>
          <p className="line-clamp-2 text-[11px] leading-4 text-muted">{agendada.texto}</p>
          {falhou && agendada.erro && (
            <p className="mt-0.5 text-[10px] leading-4 text-perigo">não saiu: {agendada.erro}</p>
          )}
          {erro && (
            <p role="alert" className="mt-0.5 text-[10px] leading-4 text-perigo">
              {erro}
            </p>
          )}
        </div>

        {!falhou && (
          <button
            type="button"
            disabled={indo}
            onClick={() =>
              comecar(async () => {
                const r = await acaoCancelarAgendada(clienteId, agendada.id)
                if (!r.ok) setErro(r.erro ?? 'não deu para cancelar')
              })
            }
            aria-label={`Cancelar a mensagem de ${agendada.nomeDoContato ?? 'sem nome'}`}
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[12px] leading-none text-dim transition hover:bg-surface hover:text-perigo disabled:opacity-40"
          >
            ×
          </button>
        )}
      </div>
    </li>
  )
}

/** "16/set às 09:00", dia e hora, sem ano, que é o que cabe e o que se pergunta. */
function quandoLegivel(iso: string): string {
  const data = new Date(iso)
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia.replace('.', '')} às ${hora}`
}
