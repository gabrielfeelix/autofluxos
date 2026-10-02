'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SeloDeMetodo, type Metodo } from './referencia'

export type ItemDaLateral = { href: string; rotulo: string; metodo?: Metodo }
export type GrupoDaLateral = { titulo: string; itens: ItemDaLateral[] }

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * A lateral da documentação: filtro no topo (atalho "/"), grupos que abrem e
 * fecham, e o selo do método ao lado de cada endpoint. O grupo da página
 * aberta começa aberto e o item ativo rola para dentro da vista.
 */
export function Lateral({ grupos, ativo }: { grupos: GrupoDaLateral[]; ativo: string }) {
  const [filtro, setFiltro] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const ativoRef = useRef<HTMLAnchorElement>(null)
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupos.map((grupo) => [grupo.titulo, true])),
  )

  useEffect(() => {
    ativoRef.current?.scrollIntoView({ block: 'nearest' })
    const atalho = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement
      if (evento.key === '/' && !['INPUT', 'TEXTAREA'].includes(alvo.tagName) && !alvo.isContentEditable) {
        evento.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const visiveis = useMemo(() => {
    const termo = normalizar(filtro.trim())
    if (!termo) return grupos
    return grupos
      .map((grupo) => ({ ...grupo, itens: grupo.itens.filter((item) => normalizar(item.rotulo).includes(termo)) }))
      .filter((grupo) => grupo.itens.length > 0)
  }, [filtro, grupos])

  return (
    <nav aria-label="Navegação da documentação" className="text-[14px]">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-dim focus-within:border-primary/50">
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={campo}
          value={filtro}
          onChange={(evento) => setFiltro(evento.target.value)}
          placeholder="Filtrar"
          aria-label="Filtrar páginas"
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-dim"
        />
        <kbd className="rounded border border-line px-1.5 font-sans text-[11px] text-dim">/</kbd>
      </label>

      <div className="mt-5 space-y-5">
        {visiveis.map((grupo) => {
          const aberto = filtro.trim() ? true : abertos[grupo.titulo] !== false
          return (
            <div key={grupo.titulo}>
              <button
                type="button"
                onClick={() => setAbertos((atual) => ({ ...atual, [grupo.titulo]: !aberto }))}
                aria-expanded={aberto}
                className="flex w-full items-center justify-between px-2.5 py-1 text-[13px] font-semibold text-ink"
              >
                {grupo.titulo}
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-dim transition-transform duration-200 ${aberto ? '' : '-rotate-90'}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="docs-grupo-corpo" data-aberto={aberto}>
                <div>
                  <ul className="mt-1 space-y-px">
                    {grupo.itens.map((item) => {
                      const eAtivo = item.href === ativo
                      return (
                        <li key={item.href}>
                          <Link
                            ref={eAtivo ? ativoRef : undefined}
                            href={item.href}
                            aria-current={eAtivo ? 'page' : undefined}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-[13.5px] leading-[1.35] transition ${
                              eAtivo ? 'bg-primary-weak font-medium text-primary' : 'text-muted hover:bg-surface hover:text-ink'
                            }`}
                          >
                            <span className="min-w-0">{item.rotulo}</span>
                            {item.metodo && <SeloDeMetodo metodo={item.metodo} pequeno />}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
        {visiveis.length === 0 && <p className="px-2.5 text-[13px] text-dim">Nada com &ldquo;{filtro}&rdquo;.</p>}
      </div>
    </nav>
  )
}
