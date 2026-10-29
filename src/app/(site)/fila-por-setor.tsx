'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { FotoDaPessoa } from './pessoas-do-site'
import b from './bento.module.css'

/*
 * A fila por setor do bento e da capa do Inbox. Troca de aba sozinha a cada
 * 3 s; clicar numa aba para o automático e fica nela (pedido do Gabriel,
 * 29/out: "quero poder mudar de aba"). A fila e o marcador da aba andam juntos
 * pelo `translate`, sem esmaecer.
 */

const SETORES = ['Vendas', 'Suporte', 'Financeiro']
const TEMPO_POR_SETOR = 3000

export function FilaPorSetor({ filas }: { filas: string[][][] }) {
  const [ativo, setAtivo] = useState(0)
  const [parado, setParado] = useState(false)

  useEffect(() => {
    if (parado || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setAtivo((a) => (a + 1) % SETORES.length), TEMPO_POR_SETOR)
    return () => window.clearTimeout(t)
  }, [ativo, parado])

  return (
    <div className={b.inbox} data-controlado style={{ '--ativo': ativo } as CSSProperties}>
      <div className={b.setores} role="tablist" aria-label="Setores">
        <span className={b.setorAtivo} aria-hidden />
        {SETORES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={i === ativo}
            onClick={() => {
              setParado(true)
              setAtivo(i)
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className={b.filas} aria-hidden>
        {filas.map((fila, f) => (
          <div key={f} className={b.fila} style={{ '--f': f } as CSSProperties}>
            {fila.map(([, nome, texto, quem]) => (
              <span key={nome} className={b.linha}>
                <i>
                  <FotoDaPessoa nome={nome!} />
                </i>
                <span>
                  <b>{nome}</b>
                  {texto}
                </span>
                <em data-espera={quem!.startsWith('espera') || undefined}>{quem}</em>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
