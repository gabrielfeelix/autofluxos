'use client'

import { useState, useTransition } from 'react'
import { acaoLigarPagina } from '@/server/acoes-lead-ads'
import type { PaginaDoToken } from '@/channels/marketing-api'
import { FotoDaPagina } from './foto-da-pagina'

/**
 * As Páginas que a conta de anúncios enxerga, cada uma com o seu botão.
 *
 * Substituiu o modal que pedia o id da Página (relato de 01/out/2026: "você
 * acha que as pessoas vão saber o ID da página?"). O token já sabe quais são;
 * a pessoa só escolhe.
 */
export function PaginasParaLigar({ clienteId, paginas }: { clienteId: string; paginas: PaginaDoToken[] }) {
  const [ligando, setLigando] = useState<string | null>(null)
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null)
  const [, iniciar] = useTransition()

  function ligar(pagina: PaginaDoToken) {
    setErro(null)
    setLigando(pagina.id)
    iniciar(async () => {
      const dados = new FormData()
      dados.set('pageId', pagina.id)
      dados.set('nome', pagina.nome)
      const r = await acaoLigarPagina(clienteId, dados)
      if (!r.ok) setErro({ id: pagina.id, texto: r.erro ?? 'não deu para ligar' })
      setLigando(null)
    })
  }

  return (
    <div className="app-card divide-y divide-line">
      {paginas.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <FotoDaPagina foto={p.foto} nome={p.nome} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{p.nome || 'Página sem nome'}</p>
            <p className="mt-0.5 text-[11px] text-dim">Página do Facebook</p>
          </div>
          <button
            type="button"
            disabled={ligando !== null}
            onClick={() => ligar(p)}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-primary-strong disabled:opacity-60"
          >
            {ligando === p.id ? 'Ligando…' : 'Ligar'}
          </button>
          {erro?.id === p.id && <p className="w-full text-[11px] text-perigo">{erro.texto}</p>}
        </div>
      ))}
    </div>
  )
}
