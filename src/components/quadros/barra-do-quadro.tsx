'use client'

import { Dropdown } from '@/components/design/dropdown'
import { comoDinheiro } from '@/core/crm'
import { DIAS_PARA_MARCAR_PARADO } from '@/core/quadros'
import type { FiltroDoQuadro, OrdemDoQuadro, SituacaoFiltro } from '@/core/quadros'
import { IconeDoQuadro, PopoverDoQuadro } from './popover-do-quadro'

const SITUACOES = [
  { valor: 'abertas', rotulo: 'Abertas' },
  { valor: 'ganhas', rotulo: 'Ganhas' },
  { valor: 'perdidas', rotulo: 'Perdidas' },
  { valor: 'todas', rotulo: 'Todas' },
]
const ORDENS = [
  { valor: 'espera', rotulo: 'Maior tempo de espera' },
  { valor: 'valor', rotulo: 'Maior valor' },
  { valor: 'recente', rotulo: 'Mais recente' },
]

export function BarraDoQuadro({
  filtro,
  aoFiltrar,
  ordem,
  aoOrdenar,
  equipe,
  visiveis,
  somaAberta,
  escondidos,
}: {
  filtro: FiltroDoQuadro
  aoFiltrar: (filtro: FiltroDoQuadro) => void
  ordem: OrdemDoQuadro
  aoOrdenar: (ordem: OrdemDoQuadro) => void
  equipe: { id: string; nome: string }[]
  visiveis: number
  somaAberta: number
  escondidos: number
}) {
  const responsavel =
    filtro.responsavel === 'ninguem'
      ? 'Sem responsável'
      : equipe.find((pessoa) => pessoa.id === filtro.responsavel)?.nome
  return (
    <div className="quadro-toolbar mb-4 flex shrink-0 flex-col gap-2.5 border-y border-line py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
            <IconeDoQuadro tipo="busca" />
          </span>
          <input
            value={filtro.busca}
            onChange={(evento) => aoFiltrar({ ...filtro, busca: evento.currentTarget.value })}
            placeholder="Buscar contato…"
            aria-label="Buscar cartão por nome, telefone ou negociação"
            className="app-field h-9 py-2 pr-8 pl-9 text-xs"
          />
          {filtro.busca && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => aoFiltrar({ ...filtro, busca: '' })}
              className="absolute top-1 right-1 grid size-7 place-items-center rounded text-muted hover:bg-surface"
            >
              ×
            </button>
          )}
        </div>
        <div className="w-[124px] shrink-0">
          <Dropdown
            rotuloAcessivel="Situação dos cartões"
            valor={filtro.situacao}
            aoMudar={(valor) => aoFiltrar({ ...filtro, situacao: valor as SituacaoFiltro })}
            opcoes={SITUACOES}
            className="text-xs"
          />
        </div>
        <PopoverDoQuadro
          rotulo="Filtros do funil"
          gatilho={
            <>
              <IconeDoQuadro tipo="filtro" />
              <span className="hidden sm:inline">Filtros</span>
              {filtro.responsavel && (
                <span className="grid size-4 place-items-center rounded bg-primary text-[10px] text-white">
                  1
                </span>
              )}
            </>
          }
        >
          <p className="quadro-menu-label">Responsável</p>
          {[
            { id: '', nome: 'Todos os responsáveis' },
            { id: 'ninguem', nome: 'Sem responsável' },
            ...equipe,
          ].map((pessoa) => (
            <button
              key={pessoa.id}
              type="button"
              data-fechar-popover
              aria-pressed={(filtro.responsavel ?? '') === pessoa.id}
              onClick={() => aoFiltrar({ ...filtro, responsavel: pessoa.id || null })}
              className="quadro-menu-item"
            >
              <span className="flex-1 truncate">{pessoa.nome}</span>
              {(filtro.responsavel ?? '') === pessoa.id && <span className="text-primary">✓</span>}
            </button>
          ))}
        </PopoverDoQuadro>
        <PopoverDoQuadro
          rotulo={`Ordenar cartões: ${ORDENS.find((item) => item.valor === ordem)?.rotulo}`}
          gatilho={
            <>
              <IconeDoQuadro tipo="ordem" />
              <span className="hidden sm:inline">Ordenar</span>
              {ordem !== 'espera' && <span className="size-1.5 rounded-full bg-primary" />}
            </>
          }
        >
          <p className="quadro-menu-label">Ordenar por</p>
          {ORDENS.map((item) => (
            <button
              key={item.valor}
              type="button"
              data-fechar-popover
              aria-pressed={ordem === item.valor}
              onClick={() => aoOrdenar(item.valor as OrdemDoQuadro)}
              className="quadro-menu-item"
            >
              <span className="flex-1">{item.rotulo}</span>
              {ordem === item.valor && <span className="text-primary">✓</span>}
            </button>
          ))}
        </PopoverDoQuadro>
        <span aria-live="polite" className="ml-auto flex items-center gap-2 text-[11px] text-dim">
          <span className="font-medium tabular-nums">
            {visiveis === 1 ? '1 contato' : `${visiveis} contatos`}
            {escondidos > 0 && ` de ${visiveis + escondidos}`}
          </span>
          {somaAberta > 0 && (
            <span className="border-l border-line pl-2 font-semibold text-soft">
              {comoDinheiro(somaAberta)} em aberto
            </span>
          )}
        </span>
        <PopoverDoQuadro
          rotulo="Ajuda sobre o funil"
          gatilho={<IconeDoQuadro tipo="ajuda" />}
          className="quadro-stage-menu"
        >
          <p className="p-2 text-xs leading-5 text-muted">
            A faixa âmbar marca quem está parado há {DIAS_PARA_MARCAR_PARADO} dias ou mais na mesma
            etapa, ou além do prazo configurado. Verde indica ganho e rosa indica perda.
          </p>
        </PopoverDoQuadro>
      </div>
      {(responsavel || ordem !== 'espera' || escondidos > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {responsavel && (
            <button
              type="button"
              onClick={() => aoFiltrar({ ...filtro, responsavel: null })}
              aria-label={`Remover filtro: ${responsavel}`}
              className="rounded-md border border-primary/15 bg-primary/[0.06] px-2 py-1 text-primary"
            >
              {responsavel}
              <span className="ml-2">×</span>
            </button>
          )}
          {ordem !== 'espera' && <span>{ORDENS.find((item) => item.valor === ordem)?.rotulo}</span>}
          {escondidos > 0 && (
            <button
              type="button"
              onClick={() => aoFiltrar({ busca: '', responsavel: null, situacao: 'todas' })}
              className="hover:text-primary"
            >
              Mostrar todos · limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}
