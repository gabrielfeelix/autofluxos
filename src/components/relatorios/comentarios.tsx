'use client'

import Link from 'next/link'
import { useState } from 'react'
import { quando } from '@/lib/quando'
import { CaixaDoBloco, Vazio } from './graficos'

export type ComentarioParaTela = {
  id: string
  contatoId: string
  nome: string | null
  nota: number
  comentario: string
  criadaEm: string
}

const NA_PRIMEIRA_TELA = 6

/** A mesma régua do NPS: 9 e 10 promovem, 7 e 8 ficam no meio, o resto detrata. */
function corDaNota(nota: number): string {
  return nota >= 9 ? 'var(--polo-bom)' : nota >= 7 ? 'var(--polo-neutro)' : 'var(--polo-ruim)'
}

/**
 * O "por quê?" da pesquisa de satisfação, do mais novo para o mais velho.
 *
 * A nota diz se melhorou; o comentário diz o quê. Ele era guardado desde a
 * 0060 e não aparecia em tela nenhuma, então quem recebia um 3 nunca sabia
 * por quê.
 */
export function ComentariosDaPesquisa({ clienteId, comentarios }: { clienteId: string; comentarios: ComentarioParaTela[] }) {
  const [todos, setTodos] = useState(false)
  const visiveis = todos ? comentarios : comentarios.slice(0, NA_PRIMEIRA_TELA)

  return (
    <CaixaDoBloco titulo="O que disseram" subtitulo="Comentários da pesquisa de satisfação, com a nota que cada pessoa deu.">
      {comentarios.length === 0 ? (
        <Vazio desenho="nps">Ninguém deixou comentário na pesquisa de satisfação neste período.</Vazio>
      ) : (
        <>
          <ul className="-mx-5 mt-1 flex flex-col">
            {visiveis.map((c) => (
              <li key={c.id} className="flex items-start gap-3 border-t border-line-soft px-5 py-2.5 first:border-t-0">
                <span
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums text-white"
                  style={{ background: corDaNota(c.nota) }}
                  aria-label={`Nota ${c.nota}`}
                >
                  {c.nota}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-[12.5px] leading-5 text-soft">“{c.comentario}”</p>
                  <p className="mt-0.5 text-[11px] text-dim">
                    {c.nome ? `${c.nome} · ` : ''}
                    {quando(c.criadaEm)} ·{' '}
                    <Link
                      href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(c.contatoId)}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      ver conversa
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {comentarios.length > NA_PRIMEIRA_TELA && (
            <button type="button" onClick={() => setTodos((v) => !v)} className="crm-edit mt-3 self-start">
              {todos ? 'Mostrar menos' : `Ver todos os ${comentarios.length}`}
            </button>
          )}
        </>
      )}
    </CaixaDoBloco>
  )
}
