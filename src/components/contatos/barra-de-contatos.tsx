'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { NIVEIS, ROTULO_DO_NIVEL } from '@/core/relacionamento'
import type { EtiquetaDeLead } from '@/server/repos/leads'
import { enderecoDosContatos, type FiltroDeContatos } from '@/core/contatos/filtro'

/** As etiquetas que o sistema deduz do histórico (não têm contagem, ver a página). */
const AUTOMATICAS: { etiqueta: EtiquetaDeLead; rotulo: string }[] = [
  { etiqueta: 'abriu_com_midia', rotulo: 'Abriu com áudio/mídia' },
  { etiqueta: 'foi_para_pessoa', rotulo: 'Foi para pessoa' },
  { etiqueta: 'nao_respondeu', rotulo: 'Não respondeu depois da primeira' },
]

/** Quanto esperar a pessoa parar de digitar antes de buscar (o mesmo da agenda). */
const ESPERA_DA_BUSCA = 400

/**
 * A barra de Contatos: busca, Filtros, Colunas e os filtros ativos.
 *
 * Antes eram duas faixas de pílulas (nível e etiquetas) sempre abertas e uma
 * busca que tomava a largura inteira. Agora as opções moram no popover, e na
 * tela fica só o que está valendo, cada um com o seu ✕.
 *
 * **Ela fica fora do `Suspense` da tabela de propósito.** A tabela remonta a
 * cada filtro (a `key` do `Suspense` muda); se a barra estivesse lá dentro, o
 * campo de busca perderia o foco e o texto no meio da digitação.
 */
export function BarraDeContatos({
  base,
  filtro,
  manuais,
  colunas,
}: {
  /** `/clientes/<id>/leads`. */
  base: string
  filtro: FiltroDeContatos
  manuais: { id: string; nome: string; contatos: number | null }[]
  /** O botão Colunas, que depende das colunas da página e por isso vem pronto. */
  colunas: ReactNode
}) {
  const router = useRouter()
  const [carregando, comecar] = useTransition()
  const [busca, setBusca] = useState(filtro.busca)
  const espera = useRef<number | null>(null)

  function ir(novo: Partial<FiltroDeContatos>) {
    comecar(() => router.push(enderecoDosContatos(base, { ...filtro, ...novo }), { scroll: false }))
  }

  // Busca que chega de fora (voltar do navegador, "Limpar tudo") manda no campo.
  const [buscaDaUrl, setBuscaDaUrl] = useState(filtro.busca)
  if (buscaDaUrl !== filtro.busca) {
    setBuscaDaUrl(filtro.busca)
    setBusca(filtro.busca)
  }

  useEffect(() => () => {
    if (espera.current) window.clearTimeout(espera.current)
  }, [])

  function digitar(valor: string) {
    setBusca(valor)
    if (espera.current) window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => {
      if (valor.trim() !== filtro.busca) ir({ busca: valor.trim() })
    }, ESPERA_DA_BUSCA)
  }

  const automatica = AUTOMATICAS.find((a) => a.etiqueta === filtro.etiqueta)
  // Etiqueta apagada enquanto o link ficou salvo: o filtro vale, só não tem nome.
  const manual = filtro.marca ? (manuais.find((m) => m.id === filtro.marca)?.nome ?? 'etiqueta apagada') : null
  const noPopover = (filtro.nivel ? 1 : 0) + (filtro.etiqueta ? 1 : 0) + (filtro.marca ? 1 : 0)
  const temFiltro = noPopover > 0 || filtro.busca !== ''

  return (
    <div className="mb-3 flex flex-col gap-2.5" aria-busy={carregando}>
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (espera.current) window.clearTimeout(espera.current)
            ir({ busca: busca.trim() })
          }}
          className="relative w-full sm:max-w-[360px] sm:flex-1"
        >
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
            <IconeDoQuadro tipo="busca" />
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => digitar(e.currentTarget.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar contato por nome ou telefone"
            maxLength={80}
            className="app-field h-9 py-2 pr-3 pl-9 text-[12.5px]"
          />
        </form>
        <PopoverDoQuadro
          rotulo="Filtros dos contatos"
          largura={300}
          gatilho={
            <>
              <IconeDoQuadro tipo="filtro" />
              <span>Filtros</span>
              {noPopover > 0 && (
                <span className="grid size-4 place-items-center rounded bg-primary text-[10px] text-white">
                  {noPopover}
                </span>
              )}
            </>
          }
        >
          {/*
            Cliente e etiqueta em seções separadas porque são perguntas
            diferentes ("quanto já me deu" e "o que marcaram nela") e somam:
            escolher Ouro não desmarca a etiqueta.
          */}
          <p className="quadro-menu-label">Cliente</p>
          {[{ valor: null, rotulo: 'Qualquer' }, ...NIVEIS.map((n) => ({ valor: n, rotulo: ROTULO_DO_NIVEL[n] }))].map(
            (opcao) => (
              <Opcao
                key={opcao.valor ?? 'qualquer'}
                ativa={filtro.nivel === opcao.valor}
                aoEscolher={() => ir({ nivel: opcao.valor })}
              >
                {opcao.rotulo}
              </Opcao>
            ),
          )}

          <p className="quadro-menu-label mt-1 border-t border-line pt-2">Etiquetas automáticas</p>
          {AUTOMATICAS.map((opcao) => (
            <Opcao
              key={opcao.etiqueta}
              ativa={filtro.etiqueta === opcao.etiqueta}
              aoEscolher={() => ir({ etiqueta: filtro.etiqueta === opcao.etiqueta ? null : opcao.etiqueta })}
            >
              {opcao.rotulo}
            </Opcao>
          ))}

          {manuais.length > 0 && (
            <>
              <p className="quadro-menu-label mt-1 border-t border-line pt-2">Suas etiquetas</p>
              {manuais.map((opcao) => (
                <Opcao
                  key={opcao.id}
                  ativa={filtro.marca === opcao.id}
                  aoEscolher={() => ir({ marca: filtro.marca === opcao.id ? null : opcao.id })}
                  contagem={opcao.contatos ?? 0}
                >
                  {opcao.nome}
                </Opcao>
              ))}
            </>
          )}
        </PopoverDoQuadro>
        {colunas}
        {carregando && <span className="text-[11.5px] text-dim">carregando…</span>}
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="text-dim">Filtros ativos:</span>
          {filtro.busca && <Chip rotulo={`Busca: ${filtro.busca}`} aoTirar={() => ir({ busca: '' })} />}
          {filtro.nivel && (
            <Chip rotulo={`Cliente: ${ROTULO_DO_NIVEL[filtro.nivel]}`} aoTirar={() => ir({ nivel: null })} />
          )}
          {automatica && <Chip rotulo={`Etiqueta: ${automatica.rotulo}`} aoTirar={() => ir({ etiqueta: null })} />}
          {manual && <Chip rotulo={`Etiqueta: ${manual}`} aoTirar={() => ir({ marca: null })} />}
          <button
            type="button"
            onClick={() => ir({ busca: '', nivel: null, etiqueta: null, marca: null })}
            className="font-semibold text-muted underline-offset-2 hover:text-primary hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}

function Opcao({
  ativa,
  aoEscolher,
  contagem,
  children,
}: {
  ativa: boolean
  aoEscolher: () => void
  contagem?: number
  children: ReactNode
}) {
  return (
    <button type="button" data-fechar-popover aria-pressed={ativa} onClick={aoEscolher} className="quadro-menu-item">
      <span className="flex-1 truncate">{children}</span>
      {contagem !== undefined && <span className="text-[11px] text-dim tabular-nums">{contagem}</span>}
      {ativa && <span className="text-primary">✓</span>}
    </button>
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
