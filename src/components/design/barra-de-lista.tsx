'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { enderecoDaLista } from '@/core/lista-de-fluxos'

/** Quanto esperar a pessoa parar de digitar antes de buscar (o mesmo de Contatos). */
const ESPERA_DA_BUSCA = 400

export type GrupoDeFiltro = {
  /** O nome do parâmetro no endereço (`canal`, `estado`...). */
  chave: string
  titulo: string
  opcoes: { valor: string; rotulo: string }[]
}

/**
 * Busca, Filtros e os filtros ativos, para qualquer lista cujo recorte mora no
 * endereço (A01). É a barra de Contatos (tarefa 2.3) sem o que era só de
 * Contatos: quem usa diz os parâmetros e as opções, e ela monta o endereço.
 *
 * Fica fora de qualquer `Suspense` com `key` que mude junto do filtro, senão o
 * campo perde o foco no meio da digitação (o mesmo cuidado de Contatos).
 */
export function BarraDeLista({
  base,
  parametros,
  busca: config,
  grupos = [],
  resumo,
}: {
  base: string
  /** O que está no endereço agora, inclusive o que a barra não mexe (`aba`). */
  parametros: Record<string, string>
  busca: { chave: string; placeholder: string; rotulo: string }
  grupos?: GrupoDeFiltro[]
  /** "8 de 12", quando há filtro. */
  resumo?: string
}) {
  const router = useRouter()
  const [carregando, comecar] = useTransition()
  const atual = parametros[config.chave] ?? ''
  const [busca, setBusca] = useState(atual)
  const espera = useRef<number | null>(null)

  function ir(novos: Record<string, string>) {
    comecar(() => router.push(enderecoDaLista(base, { ...parametros, ...novos }), { scroll: false }))
  }

  // Busca que chega de fora (voltar do navegador, "Limpar tudo") manda no campo.
  const [buscaDaUrl, setBuscaDaUrl] = useState(atual)
  if (buscaDaUrl !== atual) {
    setBuscaDaUrl(atual)
    setBusca(atual)
  }

  useEffect(() => () => {
    if (espera.current) window.clearTimeout(espera.current)
  }, [])

  function digitar(valor: string) {
    setBusca(valor)
    if (espera.current) window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => {
      if (valor.trim() !== atual) ir({ [config.chave]: valor.trim() })
    }, ESPERA_DA_BUSCA)
  }

  const ativos = grupos.flatMap((grupo) => {
    const valor = parametros[grupo.chave]
    if (!valor) return []
    // Valor que não está nas opções (pasta apagada com o link salvo) continua
    // valendo, só sem nome bonito.
    const rotulo = grupo.opcoes.find((o) => o.valor === valor)?.rotulo ?? valor
    return [{ chave: grupo.chave, rotulo: `${grupo.titulo}: ${rotulo}` }]
  })
  const temFiltro = ativos.length > 0 || atual !== ''
  const limpar = Object.fromEntries([config.chave, ...grupos.map((g) => g.chave)].map((c) => [c, '']))

  return (
    <div className="flex flex-col gap-2.5" aria-busy={carregando}>
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (espera.current) window.clearTimeout(espera.current)
            ir({ [config.chave]: busca.trim() })
          }}
          className="relative w-full sm:max-w-[320px] sm:flex-1"
        >
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
            <IconeDoQuadro tipo="busca" />
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => digitar(e.currentTarget.value)}
            placeholder={config.placeholder}
            aria-label={config.rotulo}
            maxLength={80}
            className="app-field h-9 py-2 pr-3 pl-9 text-[12.5px]"
          />
        </form>
        {grupos.length > 0 && (
          <PopoverDoQuadro
            rotulo="Filtros da lista"
            largura={260}
            gatilho={
              <>
                <IconeDoQuadro tipo="filtro" />
                <span>Filtros</span>
                {ativos.length > 0 && (
                  <span className="grid size-4 place-items-center rounded bg-primary text-[10px] text-white">
                    {ativos.length}
                  </span>
                )}
              </>
            }
          >
            {grupos.map((grupo, i) => (
              <div key={grupo.chave}>
                <p className={`quadro-menu-label ${i > 0 ? 'mt-1 border-t border-line pt-2' : ''}`}>{grupo.titulo}</p>
                {[{ valor: '', rotulo: 'Qualquer' }, ...grupo.opcoes].map((opcao) => {
                  const ativa = (parametros[grupo.chave] ?? '') === opcao.valor
                  return (
                    <button
                      key={opcao.valor || 'qualquer'}
                      type="button"
                      data-fechar-popover
                      aria-pressed={ativa}
                      onClick={() => ir({ [grupo.chave]: opcao.valor })}
                      className="quadro-menu-item"
                    >
                      <span className="flex-1 truncate">{opcao.rotulo}</span>
                      {ativa && <span className="text-primary">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </PopoverDoQuadro>
        )}
        {resumo && <span className="text-[11.5px] text-dim tabular-nums">{resumo}</span>}
        {carregando && <span className="text-[11.5px] text-dim">carregando…</span>}
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="text-dim">Filtros ativos:</span>
          {atual && <Chip rotulo={`Busca: ${atual}`} aoTirar={() => ir({ [config.chave]: '' })} />}
          {ativos.map((a) => (
            <Chip key={a.chave} rotulo={a.rotulo} aoTirar={() => ir({ [a.chave]: '' })} />
          ))}
          <button
            type="button"
            onClick={() => ir(limpar)}
            className="font-semibold text-muted underline-offset-2 hover:text-primary hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}

function Chip({ rotulo, aoTirar }: { rotulo: string; aoTirar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoTirar}
      aria-label={`Remover filtro ${rotulo}`}
      className="flex max-w-[260px] items-center gap-1.5 rounded-md border border-primary/15 bg-primary/[0.06] px-2 py-1 text-primary"
    >
      <span className="truncate">{rotulo}</span>
      <span aria-hidden>×</span>
    </button>
  )
}
