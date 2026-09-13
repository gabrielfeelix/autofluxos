'use client'

import { useState, useTransition } from 'react'
import { acaoDuplicarFluxo } from '@/server/acoes'

/**
 * Duplicar a automação da própria lista.
 *
 * **Sem confirmação.** Duplicar não destrói nada e a cópia nasce desligada:
 * perguntar "tem certeza?" para um ato reversível é o tipo de diálogo que
 * ensina a clicar em "sim" sem ler, e aí ele não protege mais o que importa —
 * que é o botão de apagar, logo ao lado.
 *
 * O aviso depois do clique existe porque a cópia **não** entra no ar: quem
 * duplicou precisa saber que ainda falta publicar, ou vai procurar no WhatsApp
 * um bot que ninguém ligou.
 */
export function DuplicarFluxo({
  clienteId,
  fluxoId,
  nome,
}: {
  clienteId: string
  fluxoId: string
  nome: string
}) {
  const [recado, setRecado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        title={`Cria uma cópia de "${nome}", desligada e sem publicar.`}
        aria-label={`Duplicar a automação ${nome}`}
        disabled={rodando}
        className="rounded px-2 py-1 text-[11px] text-dim transition hover:bg-white/10 hover:text-soft disabled:opacity-40"
        onClick={() => {
          setRecado(null)
          comecar(async () => {
            const r = await acaoDuplicarFluxo(clienteId, fluxoId)
            setRecado(
              r.ok
                ? { tipo: 'ok', texto: `"${r.nome}" criada, desligada` }
                : { tipo: 'erro', texto: r.erro ?? 'não deu para duplicar' },
            )
          })
        }}
      >
        {rodando ? 'Duplicando…' : 'Duplicar'}
      </button>
      {recado && (
        <span
          role="status"
          className={`text-[10.5px] ${recado.tipo === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}
        >
          {recado.texto}
        </span>
      )}
    </span>
  )
}
