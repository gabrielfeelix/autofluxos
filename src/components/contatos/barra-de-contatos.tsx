'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { Badge } from '@/components/design/pilula'
import { CampoDeBusca, ChipDeFiltro } from '@/components/design/campo-de-busca'
import { GrupoDoMenu, ItemDoMenu } from '@/components/design/menu-suspenso'
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
  segmentos = [],
  colunas,
}: {
  /** `/clientes/<id>/leads`. */
  base: string
  filtro: FiltroDeContatos
  manuais: { id: string; nome: string; contatos: number | null }[]
  /** Os segmentos salvos, para filtrar por um deles (CRM > Segmentos). */
  segmentos?: { id: string; nome: string }[]
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
  const doSegmento = filtro.segmento
    ? (segmentos.find((s) => s.id === filtro.segmento)?.nome ?? 'segmento apagado')
    : null
  const noPopover = (filtro.nivel ? 1 : 0) + (filtro.etiqueta ? 1 : 0) + (filtro.marca ? 1 : 0) + (filtro.segmento ? 1 : 0)
  const temFiltro = noPopover > 0 || filtro.busca !== ''

  return (
    <div className="mb-3 flex flex-col gap-2.5" aria-busy={carregando}>
      <div className="flex flex-wrap items-center gap-2">
        <CampoDeBusca
          valor={busca}
          aoDigitar={digitar}
          aoEnviar={() => {
            if (espera.current) window.clearTimeout(espera.current)
            ir({ busca: busca.trim() })
          }}
          placeholder="Buscar por nome ou telefone"
          rotulo="Buscar contato por nome ou telefone"
        />
        <PopoverDoQuadro
          rotulo="Filtros dos contatos"
          largura={300}
          gatilho={
            <>
              <IconeDoQuadro tipo="filtro" />
              <span>Filtros</span>
              {noPopover > 0 && (
<Badge>{noPopover}</Badge>
              )}
            </>
          }
        >
          {/*
            Cliente e etiqueta em seções separadas porque são perguntas
            diferentes ("quanto já me deu" e "o que marcaram nela") e somam:
            escolher Ouro não desmarca a etiqueta.
          */}
          <GrupoDoMenu titulo="Cliente">
            {[{ valor: null, rotulo: 'Qualquer' }, ...NIVEIS.map((n) => ({ valor: n, rotulo: ROTULO_DO_NIVEL[n] }))].map(
              (opcao) => (
                <ItemDoMenu
                  key={opcao.valor ?? 'qualquer'}
                  ativo={filtro.nivel === opcao.valor}
                  aoEscolher={() => ir({ nivel: opcao.valor })}
                >
                  {opcao.rotulo}
                </ItemDoMenu>
              ),
            )}
          </GrupoDoMenu>

          <GrupoDoMenu titulo="Etiquetas automáticas">
            {AUTOMATICAS.map((opcao) => (
              <ItemDoMenu
                key={opcao.etiqueta}
                ativo={filtro.etiqueta === opcao.etiqueta}
                aoEscolher={() => ir({ etiqueta: filtro.etiqueta === opcao.etiqueta ? null : opcao.etiqueta })}
              >
                {opcao.rotulo}
              </ItemDoMenu>
            ))}
          </GrupoDoMenu>

          {manuais.length > 0 && (
            <GrupoDoMenu titulo="Suas etiquetas">
              {manuais.map((opcao) => (
                <ItemDoMenu
                  key={opcao.id}
                  ativo={filtro.marca === opcao.id}
                  aoEscolher={() => ir({ marca: filtro.marca === opcao.id ? null : opcao.id })}
                  contagem={opcao.contatos ?? 0}
                >
                  {opcao.nome}
                </ItemDoMenu>
              ))}
            </GrupoDoMenu>
          )}

          {segmentos.length > 0 && (
            <GrupoDoMenu titulo="Segmentos">
              {segmentos.map((opcao) => (
                <ItemDoMenu
                  key={opcao.id}
                  ativo={filtro.segmento === opcao.id}
                  aoEscolher={() => ir({ segmento: filtro.segmento === opcao.id ? null : opcao.id })}
                >
                  {opcao.nome}
                </ItemDoMenu>
              ))}
            </GrupoDoMenu>
          )}
        </PopoverDoQuadro>
        {colunas}
        {carregando && <span className="text-[12px] text-dim">carregando…</span>}
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-dim">Filtros ativos:</span>
          {filtro.busca && <ChipDeFiltro rotulo={`Busca: ${filtro.busca}`} aoTirar={() => ir({ busca: '' })} />}
          {filtro.nivel && (
            <ChipDeFiltro rotulo={`Cliente: ${ROTULO_DO_NIVEL[filtro.nivel]}`} aoTirar={() => ir({ nivel: null })} />
          )}
          {automatica && <ChipDeFiltro rotulo={`Etiqueta: ${automatica.rotulo}`} aoTirar={() => ir({ etiqueta: null })} />}
          {manual && <ChipDeFiltro rotulo={`Etiqueta: ${manual}`} aoTirar={() => ir({ marca: null })} />}
          {doSegmento && <ChipDeFiltro rotulo={`Segmento: ${doSegmento}`} aoTirar={() => ir({ segmento: null })} />}
          <button
            type="button"
            onClick={() => ir({ busca: '', nivel: null, etiqueta: null, marca: null, segmento: null })}
            className="font-semibold text-muted underline-offset-2 hover:text-primary hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}
