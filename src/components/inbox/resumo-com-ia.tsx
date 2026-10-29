'use client'

import { useState } from 'react'
import type { ResumoDoCopiloto } from '@/server/acoes-copiloto'

/**
 * O resumo da conversa para quem assume no meio: o que o cliente quer, o que
 * já foi feito, o que falta.
 *
 * Só sai com clique: cada resumo gasta uma resposta de IA do plano, e abrir a
 * conversa para ler a última mensagem não pode custar isso. Só quem atende vê;
 * nada vai para o cliente.
 */
export function ResumoComIa({ resumir }: { resumir: () => Promise<ResumoDoCopiloto> }) {
  const [estado, setEstado] = useState<
    | { tipo: 'fechado' }
    | { tipo: 'pensando' }
    | { tipo: 'pronto'; r: Extract<ResumoDoCopiloto, { ok: true }> }
    | { tipo: 'falhou'; erro: string }
  >({ tipo: 'fechado' })

  async function pedir() {
    setEstado({ tipo: 'pensando' })
    try {
      const r = await resumir()
      setEstado(r.ok ? { tipo: 'pronto', r } : { tipo: 'falhou', erro: r.erro })
    } catch {
      setEstado({ tipo: 'falhou', erro: 'Não foi possível falar com a IA agora. Tente de novo em instantes.' })
    }
  }

  if (estado.tipo === 'fechado') {
    return (
      <div className="flex justify-end border-b border-line px-5 py-1.5">
        <button
          type="button"
          onClick={() => void pedir()}
          className="rounded-[8px] px-2 py-1 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-ink"
        >
          Resumir conversa
        </button>
      </div>
    )
  }

  const linhas: [string, string][] =
    estado.tipo === 'pronto' && estado.r.resumo
      ? [
          ['O que quer', estado.r.resumo.quer],
          ['O que já foi feito', estado.r.resumo.feito],
          ['O que falta', estado.r.resumo.falta],
        ]
      : []

  return (
    <section aria-label="Resumo da conversa" aria-busy={estado.tipo === 'pensando'} className="border-b border-line bg-surface px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Resumo da conversa</span>
        <span className="text-[11px] text-dim">· só a equipe vê</span>
        {estado.tipo !== 'pensando' && (
          <button
            type="button"
            onClick={() => void pedir()}
            className="ml-auto rounded-[8px] px-2 py-0.5 text-[11.5px] font-semibold text-muted transition hover:bg-surface-strong hover:text-ink"
          >
            Atualizar
          </button>
        )}
        <button
          type="button"
          onClick={() => setEstado({ tipo: 'fechado' })}
          aria-label="Fechar o resumo"
          className={`${estado.tipo === 'pensando' ? 'ml-auto ' : ''}rounded-full px-1.5 py-0.5 text-[13px] leading-none text-dim transition hover:bg-surface-strong hover:text-ink`}
        >
          ×
        </button>
      </div>

      {estado.tipo === 'pensando' && (
        <div className="mt-2 space-y-1.5">
          <div className="h-3 w-[80%] animate-pulse rounded bg-surface-strong" />
          <div className="h-3 w-[66%] animate-pulse rounded bg-surface-strong" />
          <div className="h-3 w-[72%] animate-pulse rounded bg-surface-strong" />
        </div>
      )}

      {estado.tipo === 'falhou' && <p className="mt-1.5 text-[12.5px] leading-5 text-perigo">{estado.erro}</p>}

      {estado.tipo === 'pronto' &&
        (linhas.length > 0 ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] leading-5">
            {linhas.map(([rotulo, texto]) => (
              <div key={rotulo} className="contents">
                <dt className="font-semibold whitespace-nowrap text-muted">{rotulo}</dt>
                <dd className="text-ink">{texto}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1.5 text-[12.5px] leading-5 whitespace-pre-wrap text-ink">{estado.r.texto}</p>
        ))}
    </section>
  )
}
