'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react'
import { createContext, useContext } from 'react'

/**
 * Quem sabe apagar a linha é o editor (é ele que tem `edges` em estado
 * controlado). O contexto leva a função até o meio da linha, onde o botão faz
 * sentido. Chamar `useReactFlow().setEdges` daqui não serve: com `edges` vindo
 * por prop, mexer no store interno deixa o estado de fora desatualizado.
 */
const AcaoDaAresta = createContext<((id: string) => void) | null>(null)

export const AcaoDaArestaProvider = AcaoDaAresta.Provider

/**
 * A linha entre dois blocos, com um **✕ no meio dela**.
 *
 * Não havia como desfazer uma ligação: a linha selecionava e nada mais, e o
 * jeito de "apagar o link" era apagar um dos blocos e refazer o trabalho. O
 * botão aparece ao passar o ponteiro por cima e some depois — linha de fluxo
 * com um botão fixo em cada uma vira um campo de minas visual.
 *
 * `interactionWidth` alarga a faixa clicável sem engordar o traço: a linha tem
 * 1,5px e mira nela com o mouse é um teste de pontaria.
 */
function ArestaRemovivel({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const apagar = useContext(AcaoDaAresta)
  const [caminho, meioX, meioY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={caminho}
        markerEnd={markerEnd}
        interactionWidth={26}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: selected ? 'var(--color-accent, #38bdf8)' : (style?.stroke ?? '#5b6577'),
        }}
      />
      <EdgeLabelRenderer>
        <div
          // `pointer-events-none` no contêiner e `auto` no botão: o rótulo cobre
          // um retângulo inteiro em cima do desenho, e sem isso ele engoliria o
          // clique de quem só queria arrastar a tela por ali.
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${meioX}px, ${meioY}px)`,
          }}
          className="nodrag nopan pointer-events-none"
        >
          <button
            type="button"
            title="Apagar esta ligação"
            aria-label="Apagar esta ligação"
            onClick={(evento) => {
              evento.stopPropagation()
              apagar?.(id)
            }}
            // Fica de leve à mostra sempre, e acende no ponteiro. Só no hover
            // ninguém descobre que dá para apagar a ligação — foi exatamente o
            // que aconteceu: a saída conhecida era apagar um dos blocos.
            className={`pointer-events-auto flex size-[20px] items-center justify-center rounded-full border border-white/15 bg-[#0b1018] text-[10px] text-muted transition hover:scale-110 hover:border-rose-400/50 hover:bg-rose-400/15 hover:text-rose-300 ${
              selected ? 'opacity-100' : 'opacity-30 hover:opacity-100'
            }`}
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const tiposDeAresta: EdgeTypes = { removivel: ArestaRemovivel }
