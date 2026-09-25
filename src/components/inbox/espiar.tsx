'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Dica } from '@/components/design/dica'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { acaoEspiar, acaoPararDeEspiar } from '@/server/acoes-espiar'

/**
 * A porta e a faixa do modo espiar. A regra de quem espia quem, e o que
 * espiar não faz, estão em `server/espiar.ts`.
 */

function Olho({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={`size-[18px] ${className}`}>
      <path
        d="M1.8 10s3-5.6 8.2-5.6 8.2 5.6 8.2 5.6-3 5.6-8.2 5.6S1.8 10 1.8 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** O olho no topo da fila: escolhe de quem espiar a caixa. */
export function MenuDeEspiar({
  clienteId,
  pessoas,
}: {
  clienteId: string
  pessoas: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [indo, setIndo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  if (pessoas.length === 0) return null

  const espiar = (pessoa: { id: string; nome: string }) => {
    setIndo(pessoa.id)
    setErro(null)
    comecar(async () => {
      const resposta = await acaoEspiar(clienteId, pessoa.id)
      if (!resposta.ok) {
        setIndo(null)
        setErro(resposta.erro)
        return
      }
      router.replace(`/clientes/${clienteId}/inbox`)
      router.refresh()
    })
  }

  return (
    <Dica texto="Espiar a caixa de alguém" lado="baixo">
      <PopoverDoQuadro
        rotulo="Espiar a caixa de alguém"
        largura={260}
        className="!min-h-0 size-8 !border-transparent !bg-transparent !p-0 text-dim hover:!bg-surface hover:text-ink"
        gatilho={indo ? <span className="size-3.5 animate-spin rounded-full border-2 border-dim border-t-transparent" /> : <Olho />}
      >
        <p className="quadro-menu-label">Espiar a caixa de</p>
        {pessoas.map((pessoa) => (
          <button
            key={pessoa.id}
            type="button"
            data-fechar-popover
            disabled={indo !== null}
            onClick={() => espiar(pessoa)}
            className="quadro-menu-item"
          >
            <span className="flex-1 truncate">{pessoa.nome}</span>
            {indo === pessoa.id && <span className="text-[11px] text-dim">Abrindo…</span>}
          </button>
        ))}
        <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-[11px] leading-4 text-dim">
          Você vê a fila como a pessoa vê. Nada fica como lido, e o cliente não recebe o visto.
        </p>
        {erro && <p className="px-2.5 pb-1 text-[11px] text-perigo">{erro}</p>}
      </PopoverDoQuadro>
    </Dica>
  )
}

/** A faixa que não deixa esquecer que está espiando, com a saída. */
export function FaixaDeEspiar({ clienteId, nome }: { clienteId: string; nome: string }) {
  const router = useRouter()
  const [saindo, comecar] = useTransition()

  const sair = () =>
    comecar(async () => {
      await acaoPararDeEspiar()
      router.replace(`/clientes/${clienteId}/inbox`)
      router.refresh()
    })

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-primary/25 bg-primary/[0.07] px-4 py-2.5 md:px-[42px]"
    >
      <Olho className="shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-ink">
        <strong className="font-bold">Espiando a caixa de {nome}.</strong>{' '}
        <span className="text-soft">Nada fica como lido, e o cliente não recebe o visto.</span>
      </p>
      <button
        type="button"
        onClick={sair}
        disabled={saindo}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {saindo ? 'Saindo…' : 'Sair do modo espiar'}
      </button>
    </div>
  )
}

/** O lugar da caixa de resposta enquanto espia. */
export function RodapeDeEspiar({ nome }: { nome: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-line px-5 py-3.5 text-[12.5px] text-dim">
      <Olho className="shrink-0" />
      <span>Você está espiando a caixa de {nome}. Para responder, saia do modo espiar.</span>
    </div>
  )
}
