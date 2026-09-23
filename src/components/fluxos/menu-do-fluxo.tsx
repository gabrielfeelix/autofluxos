'use client'

import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { useConfirmar } from '@/components/design/confirmar'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { AVISO_AO_DESLIGAR } from '@/core/entrada'
import {
  acaoAlternarFluxoAtivo,
  acaoApagarFluxo,
  acaoDuplicarFluxo,
  acaoMoverFluxo,
  acaoReordenarFluxos,
} from '@/server/acoes'

type Recado = { texto: string; erro?: boolean }

/**
 * O `⋯` da linha de automação (A01, N09): ligar/desligar, pasta, ordem,
 * duplicar e apagar.
 *
 * Eram sete controles no mesmo peso em cada linha (setas, interruptor, seletor
 * de pasta, Duplicar, Apagar). O estado continua escrito na linha ("Publicada
 * v1 · Entrada ligada"); o que muda o estado mora aqui, um clique mais longe,
 * porque é o que se faz de vez em quando, não em toda visita.
 *
 * O resultado de cada ação sai num aviso no rodapé: o menu fecha no clique, e
 * um erro escrito dentro dele sumiria junto.
 */
export function MenuDoFluxo({
  clienteId,
  fluxo,
  pastas,
  idsDoGrupo,
  emAndamento = 0,
}: {
  clienteId: string
  fluxo: { id: string; nome: string; ativo: boolean; publicada: boolean; pastaId: string | null }
  pastas: { id: string; nome: string }[]
  /** A ordem inteira do grupo (pasta), mesmo com a lista filtrada: é o que a ação regrava. */
  idsDoGrupo: string[]
  /** Conversas rodando esta automação agora (RB-44), para o aviso de desligar. */
  emAndamento?: number
}) {
  const [rodando, comecar] = useTransition()
  const [recado, setRecado] = useState<Recado | null>(null)
  const { confirmar, dialogo } = useConfirmar()
  const sumir = useCallback(() => setRecado(null), [])

  function rodar(acao: () => Promise<Recado | null>) {
    setRecado(null)
    comecar(async () => {
      const r = await acao()
      if (r) setRecado(r)
    })
  }

  const posicao = idsDoGrupo.indexOf(fluxo.id)
  function mover(direcao: -1 | 1) {
    const destino = posicao + direcao
    if (posicao < 0 || destino < 0 || destino >= idsDoGrupo.length) return
    const nova = idsDoGrupo.filter((id) => id !== fluxo.id)
    nova.splice(destino, 0, fluxo.id)
    rodar(async () => {
      const r = await acaoReordenarFluxos(clienteId, nova)
      return r.ok ? null : { texto: r.erro ?? 'não deu para reordenar', erro: true }
    })
  }

  const conversas =
    emAndamento === 1 ? '1 conversa em andamento termina' : `${emAndamento} conversas em andamento terminam`
  const bloqueado = !fluxo.ativo && !fluxo.publicada

  return (
    <>
      <PopoverDoQuadro
        rotulo={`Mais ações para ${fluxo.nome}`}
        largura={240}
        gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">{rodando ? '…' : '⋯'}</span>}
      >
        <button
          type="button"
          data-fechar-popover
          disabled={rodando || bloqueado}
          title={
            bloqueado
              ? 'Publique antes de ligar, senão ninguém recebe resposta.'
              : fluxo.ativo
                ? `Para de abrir conversa nova. ${emAndamento > 0 ? conversas : 'Quem já está conversando termina'} na versão em que começou.`
                : 'Volta a abrir conversa na próxima mensagem. Não precisa publicar de novo.'
          }
          onClick={() =>
            rodar(async () => {
              const r = await acaoAlternarFluxoAtivo(clienteId, fluxo.id, !fluxo.ativo)
              if (!r.ok) return { texto: r.erro ?? 'não deu para ligar/desligar', erro: true }
              return fluxo.ativo
                ? { texto: `“${fluxo.nome}” desligada. ${AVISO_AO_DESLIGAR}` }
                : { texto: `“${fluxo.nome}” ligada: abre conversa nova a partir da próxima mensagem.` }
            })
          }
          className="quadro-menu-item"
        >
          <span className="flex-1">{fluxo.ativo ? 'Desligar entrada' : 'Ligar entrada'}</span>
          {bloqueado && <span className="text-[10.5px] text-dim">publique antes</span>}
        </button>

        {pastas.length > 0 && (
          <>
            <p className="quadro-menu-label mt-1 border-t border-line pt-2">Mover para</p>
            {[{ id: '', nome: 'Sem pasta' }, ...pastas].map((pasta) => {
              const aqui = (fluxo.pastaId ?? '') === pasta.id
              return (
                <button
                  key={pasta.id || 'sem'}
                  type="button"
                  data-fechar-popover
                  disabled={rodando || aqui}
                  aria-pressed={aqui}
                  onClick={() =>
                    rodar(async () => {
                      const r = await acaoMoverFluxo(clienteId, fluxo.id, pasta.id)
                      return r.ok ? null : { texto: r.erro ?? 'não deu para mover', erro: true }
                    })
                  }
                  className="quadro-menu-item"
                >
                  <span className="flex-1 truncate">{pasta.nome}</span>
                  {aqui && <span className="text-primary">✓</span>}
                </button>
              )
            })}
          </>
        )}

        <div className="mt-1 border-t border-line pt-1">
          <button
            type="button"
            data-fechar-popover
            disabled={rodando || posicao <= 0}
            onClick={() => mover(-1)}
            className="quadro-menu-item"
          >
            Subir na lista
          </button>
          <button
            type="button"
            data-fechar-popover
            disabled={rodando || posicao < 0 || posicao === idsDoGrupo.length - 1}
            onClick={() => mover(1)}
            className="quadro-menu-item"
          >
            Descer na lista
          </button>
          <button
            type="button"
            data-fechar-popover
            disabled={rodando}
            title={`Cria uma cópia de “${fluxo.nome}”, desligada e sem publicar.`}
            onClick={() =>
              rodar(async () => {
                const r = await acaoDuplicarFluxo(clienteId, fluxo.id)
                return r.ok
                  ? { texto: `“${r.nome}” criada, desligada e sem publicar.` }
                  : { texto: r.erro ?? 'não deu para duplicar', erro: true }
              })
            }
            className="quadro-menu-item"
          >
            Duplicar
          </button>
        </div>

        <button
          type="button"
          data-fechar-popover
          disabled={rodando}
          onClick={() =>
            confirmar({
              titulo: 'Apagar?',
              descricao: `Apagar a automação “${fluxo.nome}”? O desenho e as versões publicadas dela somem. Recusa enquanto ela estiver ligada a um número.`,
              rotulo: 'Apagar',
              aoConfirmar: () => acaoApagarFluxo(clienteId, fluxo.id),
            })
          }
          className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
        >
          Apagar…
        </button>
      </PopoverDoQuadro>

      {dialogo}

      {/* Sempre montada: região viva que nasce junto do texto não é lida. */}
      <span role="status" className="sr-only">
        {recado?.texto ?? ''}
      </span>
      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={sumir}>
          {recado.texto}
        </AvisoFlutuante>
      )}
    </>
  )
}
