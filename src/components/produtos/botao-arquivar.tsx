'use client'

import { useState, useTransition } from 'react'
import type { Produto } from '@/core/produtos'
import { acaoArquivarProduto } from '@/server/acoes-produtos'

/**
 * Arquivar e desarquivar um item do catálogo.
 *
 * **Arquivar não pergunta; desarquivar pode recusar.** Arquivar é reversível e
 * não perde nada, então a confirmação seria atrito sem ganho. Desarquivar é
 * que tem caminho de erro: se alguém criou outro item ativo com o mesmo nome
 * enquanto este estava arquivado, o índice parcial da 0079 recusa, e a frase
 * precisa aparecer aqui em vez de o clique parecer não ter funcionado.
 */
export function BotaoArquivar({
  clienteId,
  produto,
  arquivar,
}: {
  clienteId: string
  produto: Produto
  arquivar: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={rodando}
        title={
          arquivar
            ? 'Tira da lista de escolha. As vendas que já apontam para ele continuam legíveis.'
            : 'Volta para a lista de escolha.'
        }
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoArquivarProduto(clienteId, produto.id, arquivar)
            if (!r.ok) setErro(r.erro ?? 'não deu')
          })
        }}
        className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04] disabled:opacity-50"
      >
        {arquivar ? 'Arquivar' : 'Desarquivar'}
      </button>
      {erro && <span role="alert" className="max-w-[280px] text-right text-[10.5px] leading-4 text-perigo">{erro}</span>}
    </span>
  )
}
