'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Alternador } from '@/components/design/alternador'
import { ChipDeFiltro } from '@/components/design/campo-de-busca'
import { Dropdown } from '@/components/design/dropdown'
import { Badge } from '@/components/design/pilula'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import {
  NOME_DO_TIPO,
  paraParametros,
  RECORTES_DA_AGENDA,
  TIPOS_DE_ATIVIDADE,
  type FiltroDaAgenda,
  type RecorteDaAgenda,
} from '@/core/atividades'
import { SeletorDePessoa } from './seletor-de-pessoa'

const ROTULO_DO_RECORTE: Record<RecorteDaAgenda, string> = {
  vencidas: 'Atrasadas',
  hoje: 'Hoje',
  proximas: 'Próximas',
  'sem-prazo': 'Sem prazo',
}

const SITUACOES = [
  { valor: 'aberta', rotulo: 'Abertas' },
  { valor: 'concluida', rotulo: 'Concluídas' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
]

/** Quanto esperar a pessoa parar de digitar antes de buscar. */
const ESPERA_DA_BUSCA = 400

/**
 * A barra da agenda: atalhos, busca, situação, filtros e alcance.
 *
 * Tudo mora na URL (`paraParametros`): filtro sobrevive a recarregar, a voltar
 * da ficha e a ser mandado para um colega. Mudar qualquer filtro volta para a
 * página 1, porque "página 4 das vencidas" não é a página 4 de hoje.
 */
export function BarraDaAgenda({
  base,
  filtro,
  contagens,
  equipe,
  podeVerEquipe,
}: {
  /** `/clientes/<id>/atividades`. */
  base: string
  filtro: FiltroDaAgenda
  contagens: Record<RecorteDaAgenda, number>
  equipe: { id: string; nome: string }[]
  /** Só quem tem escopo de equipe ou da conta vê a alternância Minhas/Equipe. */
  podeVerEquipe: boolean
}) {
  const router = useRouter()
  const [carregando, comecar] = useTransition()
  const [busca, setBusca] = useState(filtro.busca)
  const [escolhendoResponsavel, setEscolhendoResponsavel] = useState(false)
  const espera = useRef<number | null>(null)

  function ir(novo: Partial<FiltroDaAgenda>) {
    const destino = paraParametros({ ...filtro, pagina: 1, ...novo }).toString()
    comecar(() => router.push(destino ? `${base}?${destino}` : base, { scroll: false }))
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

  const responsavel =
    filtro.responsavel === 'ninguem'
      ? 'Sem responsável'
      : filtro.responsavel
        ? (equipe.find((p) => p.id === filtro.responsavel)?.nome ?? 'Outra pessoa')
        : null
  const filtrosNoPopover = (filtro.tipo ? 1 : 0) + (filtro.responsavel ? 1 : 0)
  const temFiltro =
    filtro.busca !== '' || filtro.tipo !== null || filtro.responsavel !== null || filtro.recorte !== null || filtro.situacao !== 'aberta'

  return (
    <div className="mb-4 flex flex-col gap-3" aria-busy={carregando}>
      <div role="group" aria-label="Atalhos por prazo" className="flex flex-wrap gap-2">
        {RECORTES_DA_AGENDA.map((recorte) => {
          const ativo = filtro.recorte === recorte
          return (
            <button
              key={recorte}
              type="button"
              aria-pressed={ativo}
              onClick={() => ir({ recorte: ativo ? null : recorte, situacao: 'aberta' })}
              className="chip-vidro"
            >
              {ROTULO_DO_RECORTE[recorte]}
              {/* Atrasada é a única que pede ação: ela ganha o badge coral. */}
              {recorte === 'vencidas' && contagens[recorte] > 0 && !ativo ? (
                <Badge tom="alerta">{contagens[recorte]}</Badge>
              ) : (
                <span className="chip-vidro-conta">{contagens[recorte]}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (espera.current) window.clearTimeout(espera.current)
            ir({ busca: busca.trim() })
          }}
          className="campo-de-busca relative w-full sm:max-w-[380px] sm:flex-1"
        >
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
            <IconeDoQuadro tipo="busca" />
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => digitar(e.currentTarget.value)}
            placeholder="Buscar por título ou contato"
            aria-label="Buscar atividade por título, nome ou telefone do contato"
            maxLength={80}
            className="app-field h-9 py-2 pr-3 pl-9 text-[13px]"
          />
        </form>
        <div className="w-[120px] shrink-0 sm:w-[136px]">
          <Dropdown
            rotuloAcessivel="Situação das atividades"
            valor={filtro.situacao}
            aoMudar={(valor) => ir({ situacao: valor as FiltroDaAgenda['situacao'], recorte: null })}
            opcoes={SITUACOES}
            className="text-[12px]"
          />
        </div>
        <PopoverDoQuadro
          rotulo="Filtros da agenda"
          largura={280}
          gatilho={
            <>
              <IconeDoQuadro tipo="filtro" />
              <span>Filtros</span>
              {filtrosNoPopover > 0 && <Badge>{filtrosNoPopover}</Badge>}
            </>
          }
        >
          <p className="quadro-menu-label">Tipo</p>
          {[{ valor: '', rotulo: 'Todos os tipos' }, ...TIPOS_DE_ATIVIDADE.map((t) => ({ valor: t, rotulo: NOME_DO_TIPO[t] }))].map(
            (opcao) => (
              <button
                key={opcao.valor}
                type="button"
                data-fechar-popover
                aria-pressed={(filtro.tipo ?? '') === opcao.valor}
                onClick={() => ir({ tipo: (opcao.valor || null) as FiltroDaAgenda['tipo'] })}
                className="quadro-menu-item"
              >
                <span className="flex-1 first-letter:uppercase">{opcao.rotulo}</span>
                {(filtro.tipo ?? '') === opcao.valor && <span className="text-primary">✓</span>}
              </button>
            ),
          )}
          {podeVerEquipe && filtro.alcance === 'equipe' && (
            <>
              <p className="quadro-menu-label mt-1 border-t border-line pt-2">Responsável</p>
              <button
                type="button"
                data-fechar-popover
                onClick={() => setEscolhendoResponsavel(true)}
                className="quadro-menu-item"
              >
                <span className="flex-1 truncate">{responsavel ?? 'Todos os responsáveis'}</span>
                <span className="text-[11.5px] font-semibold text-primary">Escolher…</span>
              </button>
            </>
          )}
        </PopoverDoQuadro>
        {escolhendoResponsavel && (
          <SeletorDePessoa
            titulo="Filtrar por responsável"
            pessoas={equipe}
            fixas={[
              { id: '', nome: 'Todos os responsáveis' },
              { id: 'ninguem', nome: 'Sem responsável' },
            ]}
            atual={filtro.responsavel ?? ''}
            aoEscolher={(id) => ir({ responsavel: id || null })}
            aoFechar={() => setEscolhendoResponsavel(false)}
          />
        )}
        {podeVerEquipe && (
          <Alternador
            rotulo="De quem"
            ativa={filtro.alcance}
            aoEscolher={(alcance) => ir({ alcance, responsavel: null })}
            opcoes={[
              { chave: 'minhas', rotulo: 'Minhas' },
              { chave: 'equipe', rotulo: 'Equipe' },
            ]}
          />
        )}
        {carregando && <span className="text-[11.5px] text-dim">carregando…</span>}
        <Alternador
          rotulo="Como mostrar"
          className="sm:ml-auto"
          ativa={filtro.vista}
          aoEscolher={(vista) => ir({ vista })}
          opcoes={(['lista', 'agenda'] as const).map((vista) => ({
            chave: vista,
            rotulo: vista === 'lista' ? 'Lista' : 'Agenda',
            icone: <IconeDaVista vista={vista} />,
          }))}
        />
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="text-dim">Filtros ativos:</span>
          {filtro.recorte && (
            <ChipDeFiltro rotulo={`Prazo: ${ROTULO_DO_RECORTE[filtro.recorte]}`} aoTirar={() => ir({ recorte: null })} />
          )}
          {filtro.situacao !== 'aberta' && (
            <ChipDeFiltro
              rotulo={`Situação: ${SITUACOES.find((s) => s.valor === filtro.situacao)?.rotulo}`}
              aoTirar={() => ir({ situacao: 'aberta' })}
            />
          )}
          {filtro.busca && <ChipDeFiltro rotulo={`Busca: ${filtro.busca}`} aoTirar={() => ir({ busca: '' })} />}
          {filtro.tipo && <ChipDeFiltro rotulo={`Tipo: ${NOME_DO_TIPO[filtro.tipo]}`} aoTirar={() => ir({ tipo: null })} />}
          {responsavel && <ChipDeFiltro rotulo={`Responsável: ${responsavel}`} aoTirar={() => ir({ responsavel: null })} />}
          <button
            type="button"
            onClick={() => ir({ busca: '', tipo: null, responsavel: null, recorte: null, situacao: 'aberta' })}
            className="font-semibold text-muted underline-offset-2 hover:text-primary hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}

function IconeDaVista({ vista }: { vista: 'lista' | 'agenda' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {vista === 'lista' ? (
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
      ) : (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </>
      )}
    </svg>
  )
}
