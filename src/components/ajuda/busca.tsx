'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { buscarArtigos, categoriaDe } from './artigos'

/**
 * A busca da central. Procura no catálogo enquanto a pessoa digita e mostra os
 * artigos numa lista logo abaixo do campo; Enter abre o primeiro, as setas
 * escolhem outro. Sem resultado, a lista oferece o WhatsApp da equipe em vez
 * de uma tela vazia.
 *
 * `grande` é a da home (o campo é o centro da página); a outra fica no topo do
 * artigo, para trocar de assunto sem voltar.
 */
export function BuscaDaAjuda({ grande = false, whatsapp }: { grande?: boolean; whatsapp: string }) {
  const router = useRouter()
  const idDaLista = useId()
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const resultados = useMemo(() => buscarArtigos(busca).slice(0, 6), [busca])
  const mostrar = aberta && busca.trim().length > 0

  return (
    <div className="relative w-full">
      <label
        className={`flex items-center gap-3 rounded-2xl bg-white text-[#0c1838] shadow-[0_24px_48px_-28px_rgb(8_20_70/0.75)] ring-1 ring-white/40 focus-within:ring-4 focus-within:ring-white/35 ${grande ? 'h-[60px] px-5' : 'h-12 px-4'}`}
      >
        <svg aria-hidden width={grande ? 22 : 18} height={grande ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-[#66708a]">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value)
            setMarcado(0)
            setAberta(true)
          }}
          onFocus={() => setAberta(true)}
          onBlur={() => window.setTimeout(() => setAberta(false), 120)}
          onKeyDown={(evento) => {
            if (!mostrar || resultados.length === 0) return
            if (evento.key === 'ArrowDown') {
              evento.preventDefault()
              setMarcado((atual) => (atual + 1) % resultados.length)
            } else if (evento.key === 'ArrowUp') {
              evento.preventDefault()
              setMarcado((atual) => (atual - 1 + resultados.length) % resultados.length)
            } else if (evento.key === 'Enter') {
              evento.preventDefault()
              const escolhido = resultados[marcado]
              if (escolhido) router.push(`/ajuda/${escolhido.id}`)
            } else if (evento.key === 'Escape') {
              setAberta(false)
            }
          }}
          placeholder={grande ? 'Exemplo: como marcar horário pela conversa' : 'Pesquisar na central de ajuda'}
          aria-label="Pesquisar na central de ajuda"
          aria-expanded={mostrar}
          aria-controls={idDaLista}
          role="combobox"
          autoComplete="off"
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#828c9e] [&::-webkit-search-cancel-button]:hidden ${grande ? 'text-[16px]' : 'text-[14px]'}`}
        />
      </label>

      {mostrar && (
        <div
          id={idDaLista}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[#0c1838]/[0.08] bg-white p-1.5 text-left shadow-[0_28px_60px_-24px_rgb(8_20_70/0.55)]"
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-5 text-[14px] text-[#56617c]">
              Nenhum artigo para &ldquo;{busca.trim()}&rdquo;.{' '}
              <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-[#1d4ed8] hover:underline">
                Pergunte à equipe no WhatsApp
              </a>
              .
            </p>
          ) : (
            resultados.map((artigo, indice) => (
              <Link
                key={artigo.id}
                href={`/ajuda/${artigo.id}`}
                role="option"
                aria-selected={indice === marcado}
                onMouseEnter={() => setMarcado(indice)}
                className={`block rounded-xl px-4 py-3 transition ${indice === marcado ? 'bg-[#eef3ff]' : ''}`}
              >
                <span className="block text-[12px] font-medium text-[#66708a]">{categoriaDe(artigo).titulo}</span>
                <span className="mt-0.5 block text-[14.5px] font-semibold text-[#0c1838]">{artigo.titulo}</span>
                <span className="mt-0.5 block truncate text-[13px] text-[#56617c]">{artigo.resumo}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
