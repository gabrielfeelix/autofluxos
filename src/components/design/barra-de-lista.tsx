'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { CampoDeBusca, ChipDeFiltro } from './campo-de-busca'
import { GrupoDoMenu, ItemDoMenu } from './menu-suspenso'
import { Badge } from './pilula'
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
  acoes,
  className = 'mb-3',
}: {
  base: string
  /** O que está no endereço agora, inclusive o que a barra não mexe (`aba`). */
  parametros: Record<string, string>
  busca: { chave: string; placeholder: string; rotulo: string }
  grupos?: GrupoDeFiltro[]
  /** "8 de 12", quando há filtro. */
  resumo?: ReactNode
  /** Ações da lista ("Marcar todos como vistos"), na mesma linha, à direita. */
  acoes?: ReactNode
  /** A folga até o cartão. A barra mora fora dele, logo abaixo do topo. */
  className?: string
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
    <div className={`flex flex-col gap-2.5 ${className}`} aria-busy={carregando}>
      <div className="flex flex-wrap items-center gap-2">
        <CampoDeBusca
          valor={busca}
          aoDigitar={digitar}
          aoEnviar={() => {
            if (espera.current) window.clearTimeout(espera.current)
            ir({ [config.chave]: busca.trim() })
          }}
          placeholder={config.placeholder}
          rotulo={config.rotulo}
        />
        {grupos.length > 0 && (
          <PopoverDoQuadro
            rotulo="Filtros da lista"
            largura={260}
            gatilho={
              <>
                <IconeDoQuadro tipo="filtro" />
                <span>Filtros</span>
                {ativos.length > 0 && <Badge>{ativos.length}</Badge>}
              </>
            }
          >
            {grupos.map((grupo) => (
              <GrupoDoMenu key={grupo.chave} titulo={grupo.titulo}>
                {[{ valor: '', rotulo: 'Qualquer' }, ...grupo.opcoes].map((opcao) => (
                  <ItemDoMenu
                    key={opcao.valor || 'qualquer'}
                    ativo={(parametros[grupo.chave] ?? '') === opcao.valor}
                    aoEscolher={() => ir({ [grupo.chave]: opcao.valor })}
                  >
                    {opcao.rotulo}
                  </ItemDoMenu>
                ))}
              </GrupoDoMenu>
            ))}
          </PopoverDoQuadro>
        )}
        {resumo && <span className="text-[12.5px] text-muted tabular-nums">{resumo}</span>}
        {carregando && <span className="text-[12px] text-dim">carregando…</span>}
        {acoes && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{acoes}</div>}
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-dim">Filtros ativos:</span>
          {atual && <ChipDeFiltro rotulo={`Busca: ${atual}`} aoTirar={() => ir({ [config.chave]: '' })} />}
          {ativos.map((a) => (
            <ChipDeFiltro key={a.chave} rotulo={a.rotulo} aoTirar={() => ir({ [a.chave]: '' })} />
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
