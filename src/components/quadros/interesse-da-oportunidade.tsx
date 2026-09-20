'use client'

import { useEffect, useState, useTransition } from 'react'
import type { Produto } from '@/core/produtos'
import { selecionaveis } from '@/core/produtos'
import { acaoDefinirInteresse, acaoListarProdutos } from '@/server/acoes-produtos'

/**
 * No que esta negociação está interessada (0079).
 *
 * **O catálogo chega sob demanda**, ao abrir o seletor, e não com o quadro:
 * carregar a lista de produtos para cinquenta cartões que ninguém vai abrir
 * seria cinquenta consultas por uma leitura. É a mesma escolha que o painel já
 * fez para a linha do tempo.
 *
 * **O nome de hoje aparece mesmo quando o item foi arquivado depois.** Quem
 * vinculou "Plano Antigo" em março continua lendo "Plano Antigo", porque
 * esconder o vínculo faria a tela dizer "sem interesse" sobre uma negociação
 * que tem um. Arquivar tira da escolha, não da leitura (RB-24).
 */
export function InteresseDaOportunidade({
  clienteId,
  cartaoId,
  produtoId,
  produtoNome,
}: {
  clienteId: string
  cartaoId: string
  produtoId: string | null
  produtoNome: string | null
}) {
  const [editando, setEditando] = useState(false)
  const [catalogo, setCatalogo] = useState<Produto[] | null>(null)
  const [escolhido, setEscolhido] = useState(produtoId ?? '')
  const [nome, setNome] = useState(produtoNome)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  useEffect(() => {
    if (!editando || catalogo !== null) return
    let valeu = true

    acaoListarProdutos(clienteId)
      .then((r) => {
        if (!valeu) return
        if (r.ok) setCatalogo(r.produtos)
        else setErro(r.erro)
      })
      .catch(() => {
        if (valeu) setErro('não deu para ler o catálogo')
      })

    return () => {
      valeu = false
    }
  }, [editando, catalogo, clienteId])

  if (!editando) {
    return (
      <span className="flex items-center gap-2">
        <span className={`flex-1 text-[12.5px] ${nome ? '' : 'text-dim'}`}>
          {nome ?? 'não informado'}
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04]"
        >
          {nome ? 'Trocar' : 'Escolher'}
        </button>
      </span>
    )
  }

  // O item já vinculado entra na lista mesmo se estiver arquivado: sem isso o
  // seletor abriria sem o valor atual selecionado e "salvar" apagaria o
  // vínculo de quem só queria olhar.
  const opcoes = catalogo
    ? [
        ...selecionaveis(catalogo),
        ...catalogo.filter((p) => p.id === produtoId && p.arquivadoEm !== null),
      ]
    : []

  return (
    <span className="flex flex-col gap-1.5">
      <select
        value={escolhido}
        disabled={catalogo === null || rodando}
        onChange={(e) => setEscolhido(e.target.value)}
        aria-label="Interesse desta negociação"
        className="app-field px-2.5 py-1.5 text-[12.5px]"
      >
        <option value="">não informado</option>
        {opcoes.map((produto) => (
          <option key={produto.id} value={produto.id}>
            {produto.nome}
            {produto.arquivadoEm ? ' (arquivado)' : ''}
          </option>
        ))}
      </select>

      {catalogo !== null && opcoes.length === 0 && (
        <span className="text-[10.5px] leading-4 text-dim">
          O catálogo está vazio. Cadastre em Configurações → Catálogo.
        </span>
      )}

      <span className="flex gap-1.5">
        <button
          type="button"
          disabled={rodando || catalogo === null}
          onClick={() => {
            setErro(null)
            comecar(async () => {
              const r = await acaoDefinirInteresse(clienteId, cartaoId, escolhido)
              if (!r.ok) {
                setErro(r.erro ?? 'não deu')
                return
              }
              setNome(opcoes.find((p) => p.id === escolhido)?.nome ?? null)
              setEditando(false)
            })
          }}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={rodando}
          onClick={() => {
            setEscolhido(produtoId ?? '')
            setErro(null)
            setEditando(false)
          }}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          Cancelar
        </button>
      </span>

      {erro && (
        <span role="alert" className="text-[10.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
