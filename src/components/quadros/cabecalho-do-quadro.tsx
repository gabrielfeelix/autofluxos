'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Modal } from '@/components/design/modal'
import type { DestaqueDoRamo } from '@/core/nichos'
import { NovoQuadro } from './novo-quadro'
import { IconeDoQuadro, PopoverDoQuadro } from './popover-do-quadro'

export function CabecalhoDoQuadro({
  clienteId,
  quadros,
  abertoId,
  adicionar,
  configuracoes,
  importar,
  apagar,
  fora,
  visao = 'quadro',
  destaqueDeFunis = null,
}: {
  clienteId: string
  quadros: { id: string; nome: string }[]
  abertoId?: string
  /** Quadro | Lista (5.2b): o mesmo funil, desenhado de dois jeitos. */
  visao?: 'quadro' | 'lista'
  adicionar?: ReactNode
  configuracoes?: ReactNode
  importar?: ReactNode
  apagar?: ReactNode
  fora: number
  /** O funil do ramo da conta, para o "Novo funil" do seletor. */
  destaqueDeFunis?: DestaqueDoRamo | null
}) {
  const [painel, setPainel] = useState<'configuracoes' | 'importar' | null>(null)
  const atual = quadros.find((quadro) => quadro.id === abertoId)

  return (
    <header className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden size-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary sm:flex">
          <IconeDoQuadro tipo="quadro" />
        </span>
        <div className="min-w-0">
          <h1 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-dim uppercase">
            Negócios
          </h1>
          {atual ? (
            <NovoQuadro
              clienteId={clienteId}
              primeiro={false}
              destaque={destaqueDeFunis}
              acionador={(abrir) => (
                <PopoverDoQuadro
                  rotulo="Trocar funil"
                  gatilho={
                    <>
                      <span className="max-w-[230px] truncate text-[21px] font-bold tracking-[-0.035em]">
                        {atual.nome}
                      </span>
                      <IconeDoQuadro tipo="seta" />
                    </>
                  }
                  className="quadro-seletor"
                  largura={300}
                >
                  <p className="quadro-menu-label">Seus funis</p>
                  <nav aria-label="Funis" className="max-h-64 overflow-y-auto">
                    {quadros.map((quadro) => (
                      <Link
                        key={quadro.id}
                        href={`/clientes/${clienteId}/quadros?q=${quadro.id}${visao === 'lista' ? '&ver=lista' : ''}`}
                        aria-current={quadro.id === abertoId ? 'page' : undefined}
                        data-fechar-popover
                        className={`quadro-menu-item ${quadro.id === abertoId ? 'bg-primary/[0.08] text-primary' : ''}`}
                      >
                        <IconeDoQuadro tipo="quadro" />
                        <span className="min-w-0 flex-1 truncate">{quadro.nome}</span>
                        {quadro.id === abertoId && <span aria-hidden>✓</span>}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-1 border-t border-line pt-1">
                    <button
                      type="button"
                      onClick={abrir}
                      data-fechar-popover
                      className="quadro-menu-item text-primary"
                    >
                      + Novo funil
                    </button>
                  </div>
                </PopoverDoQuadro>
              )}
            />
          ) : (
            <span className="text-xl font-bold">Seu processo, organizado.</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {atual && (
          <nav
            aria-label="Ver negócios como"
            className="flex rounded-lg border border-line bg-surface p-0.5 text-[12.5px] font-semibold"
          >
            {(
              [
                ['quadro', 'Quadro'],
                ['lista', 'Lista'],
              ] as const
            ).map(([chave, rotulo]) => (
              <Link
                key={chave}
                href={`/clientes/${clienteId}/quadros?q=${atual.id}${chave === 'lista' ? '&ver=lista' : ''}`}
                aria-current={visao === chave ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 transition ${
                  visao === chave ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(19,25,34,0.08)]' : 'text-muted hover:text-soft'
                }`}
              >
                {rotulo}
              </Link>
            ))}
          </nav>
        )}
        {/* `.quadro-tool` define o próprio display e venceria um `hidden` na
            mesma tag; quem esconde no celular é o invólucro. Lá a barra de
            baixo já tem Atividades. */}
        <span className="hidden sm:contents">
          <Link href={`/clientes/${clienteId}/atividades`} className="quadro-tool">
            Atividades
          </Link>
        </span>
        {adicionar}
        {atual && (
          <PopoverDoQuadro
            rotulo="Ações do funil"
            gatilho={<IconeDoQuadro tipo="menu" />}
            className="quadro-icon-button"
          >
            <p className="quadro-menu-label">Gerenciar funil</p>
            <button
              type="button"
              data-fechar-popover
              onClick={() => setPainel('configuracoes')}
              className="quadro-menu-item"
            >
              <IconeDoQuadro tipo="ajustes" />
              Configurações do funil
            </button>
            <button
              type="button"
              data-fechar-popover
              onClick={() => setPainel('importar')}
              className="quadro-menu-item"
            >
              <IconeDoQuadro tipo="pessoas" />
              <span className="flex-1">Adicionar contatos existentes</span>
              {fora > 0 && (
                <span className="rounded bg-surface-strong px-1.5 text-[10px] tabular-nums">
                  {fora}
                </span>
              )}
            </button>
            <div className="quadro-danger mt-1 border-t border-line pt-1">{apagar}</div>
          </PopoverDoQuadro>
        )}
      </div>
      <Modal
        aberto={painel === 'configuracoes'}
        aoFechar={() => setPainel(null)}
        titulo="Configurações do funil"
        descricao={atual?.nome}
        largura={480}
      >
        <div className="flex flex-col gap-6">{configuracoes}</div>
      </Modal>
      <Modal
        aberto={painel === 'importar'}
        aoFechar={() => setPainel(null)}
        titulo="Adicionar contatos existentes"
        descricao="Traga os contatos da sua lista para a primeira etapa deste funil."
        largura={480}
      >
        {fora > 0 ? (
          importar
        ) : (
          <p className="text-sm text-muted">Todos os contatos da sua lista já estão neste funil.</p>
        )}
      </Modal>
    </header>
  )
}
