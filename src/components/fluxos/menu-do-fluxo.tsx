'use client'

import Link from 'next/link'
import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { useConfirmar } from '@/components/design/confirmar'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { acaoApagarFluxo, acaoDuplicarFluxo, acaoMoverFluxo } from '@/server/acoes'

type Recado = { texto: string; erro?: boolean }

/**
 * O `⋯` da linha de automação (A01, N09): respostas, pasta, duplicar e apagar.
 *
 * Eram sete controles no mesmo peso em cada linha. Ficam na linha só o
 * interruptor (ligada ou desligada é o que mais importa) e a alça de arrastar,
 * que trocou o "Subir/Descer na lista"; o resto mora aqui, porque é o que se
 * faz de vez em quando, não em toda visita.
 *
 * O resultado de cada ação sai num aviso no rodapé: o menu fecha no clique, e
 * um erro escrito dentro dele sumiria junto.
 */
export function MenuDoFluxo({
  clienteId,
  fluxo,
  pastas,
  respostas,
}: {
  clienteId: string
  fluxo: { id: string; nome: string; pastaId: string | null }
  pastas: { id: string; nome: string }[]
  /** Quantas vezes a automação rodou: o número ao lado de "Ver respostas". */
  respostas: number
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


  return (
    <>
      <PopoverDoQuadro
        rotulo={`Mais ações para ${fluxo.nome}`}
        largura={240}
        gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">{rodando ? '…' : '⋯'}</span>}
      >
        <Link
          href={`/clientes/${clienteId}/respostas?fluxo=${fluxo.id}`}
          data-fechar-popover
          title={`Ver o que as pessoas responderam em “${fluxo.nome}”`}
          className="quadro-menu-item"
        >
          <span className="flex-1">Ver respostas</span>
          <span className="text-[10.5px] text-dim">{respostas}</span>
        </Link>

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
