'use client'

import { useState, useTransition } from 'react'
import { acaoLigarPagina } from '@/server/acoes-lead-ads'
import type { PaginaDoToken } from '@/channels/marketing-api'
import { FotoDaPagina } from './foto-da-pagina'
import { CartaoDeConexao, GRADE_DE_CONEXOES } from '@/components/conexoes/cartao'
import { Pilula } from '@/components/design/pilula'

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
    <div className={GRADE_DE_CONEXOES}>
      {paginas.map((p) => (
        <CartaoDeConexao
          key={p.id}
          logo={<FotoDaPagina foto={p.foto} nome={p.nome} />}
          selo={<Pilula>não ligada</Pilula>}
          titulo={p.nome || 'Página sem nome'}
          categoria="Página do Facebook"
          rodape={
            <button
              type="button"
              disabled={ligando !== null}
              onClick={() => ligar(p)}
              className="botao-primario botao-sm"
            >
              {ligando === p.id ? 'Ligando…' : 'Ligar esta Página'}
            </button>
          }
        >
          A conta da Meta enxerga esta Página. Ligue para os leads dela entrarem aqui.
          {erro?.id === p.id && <p className="mt-2 text-[11px] text-perigo">{erro.texto}</p>}
        </CartaoDeConexao>
      ))}
    </div>
  )
}
