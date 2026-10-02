'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

export type EntradaDaBusca = { href: string; titulo: string; grupo: string; area: string; termos: string }

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * A busca de toda a central, aberta pelo botão do cabeçalho ou por ⌘K / Ctrl+K.
 * Procura nas duas áreas (ajuda e desenvolvedores) e agrupa o resultado por
 * área. É `<dialog>` modal: Esc fecha e o foco fica preso nela.
 */
export function BuscaK({ entradas }: { entradas: EntradaDaBusca[] }) {
  const router = useRouter()
  const dialogo = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [busca, setBusca] = useState('')
  const [marcado, setMarcado] = useState(0)
  const [mac, setMac] = useState(false)

  const abrir = () => {
    setBusca('')
    setMarcado(0)
    dialogo.current?.showModal()
    campo.current?.focus()
  }

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const atalho = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        abrir()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const resultados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    if (termos.length === 0) return entradas.slice(0, 8)
    return entradas
      .filter((entrada) => {
        const alvo = normalizar(`${entrada.titulo} ${entrada.grupo} ${entrada.termos}`)
        return termos.every((termo) => alvo.includes(termo))
      })
      .slice(0, 10)
  }, [busca, entradas])

  const ir = (href: string) => {
    dialogo.current?.close()
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-[13.5px] text-white/85 transition hover:bg-white/[0.18] hover:text-white md:w-[240px]"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden md:inline">Pesquisar</span>
        <kbd className="ml-auto hidden rounded-md border border-white/25 px-1.5 py-px font-sans text-[11px] text-white/75 md:inline">
          {mac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      <dialog
        ref={dialogo}
        aria-label="Pesquisar na documentação"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) evento.currentTarget.close()
        }}
        className="docs-busca m-auto mt-[12vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line bg-panel p-0 text-ink shadow-[0_40px_80px_-30px_rgb(8_20_70/0.6)]"
      >
        <div className="flex h-14 items-center gap-3 border-b border-line px-4">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-dim">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={campo}
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value)
              setMarcado(0)
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'ArrowDown') {
                evento.preventDefault()
                setMarcado((atual) => Math.min(atual + 1, resultados.length - 1))
              } else if (evento.key === 'ArrowUp') {
                evento.preventDefault()
                setMarcado((atual) => Math.max(atual - 1, 0))
              } else if (evento.key === 'Enter') {
                const escolhido = resultados[marcado]
                if (escolhido) ir(escolhido.href)
              }
            }}
            placeholder="Exemplo: assinatura do webhook"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
          />
          <kbd className="rounded-md border border-line px-1.5 py-px text-[11px] text-dim">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {resultados.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-muted">Nenhuma página com &ldquo;{busca}&rdquo;.</p>
          ) : (
            resultados.map((entrada, indice) => (
              <button
                key={entrada.href}
                type="button"
                onMouseEnter={() => setMarcado(indice)}
                onClick={() => ir(entrada.href)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${indice === marcado ? 'bg-primary-weak' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-medium ${indice === marcado ? 'text-primary' : 'text-ink'}`}>{entrada.titulo}</span>
                  <span className="block text-[12.5px] text-dim">
                    {entrada.area}, {entrada.grupo}
                  </span>
                </span>
                {indice === marcado && <kbd className="text-[11px] text-dim">Enter</kbd>}
              </button>
            ))
          )}
        </div>
      </dialog>
    </>
  )
}
