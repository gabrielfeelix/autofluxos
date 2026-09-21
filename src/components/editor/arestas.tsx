'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react'
import { createContext, useContext, useRef, useState, type PointerEvent } from 'react'

/** O desvio que quem monta deu na linha, em coordenadas do desenho. */
export type Desvio = { x: number; y: number }

export type AcoesDaAresta = {
  apagar: (id: string) => void
  desviar: (id: string, desvio: Desvio | null) => void
}

/**
 * Quem sabe apagar a linha, e guardar o desvio dela, é o editor (é ele que tem
 * `edges` em estado controlado). O contexto leva as duas funções até a linha.
 * Chamar `useReactFlow().setEdges` daqui não serve: com `edges` vindo por prop,
 * mexer no store interno deixa o estado de fora desatualizado.
 */
const AcaoDaAresta = createContext<AcoesDaAresta | null>(null)

export const AcaoDaArestaProvider = AcaoDaAresta.Provider

/**
 * O caminho de uma linha que foi puxada para fora do lugar.
 *
 * São duas curvas cúbicas emendadas no ponto que a pessoa arrastou, com as
 * alças **horizontais** nas duas pontas. Horizontal porque as bolinhas de saída
 * e de entrada dos blocos são esquerda/direita: uma alça vertical faria a linha
 * sair do bloco para cima e voltar, um S que ninguém pediu.
 *
 * A força da alça acompanha a distância percorrida, com piso de 30px. Sem o
 * piso, desvio curto vira bico em vez de curva; sem o acompanhar, desvio longo
 * vira uma reta com dois cotovelos.
 */
function caminhoDesviado(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  mx: number,
  my: number,
): string {
  const alcaDaSaida = Math.max(30, Math.abs(mx - sx) * 0.5)
  const alcaDaChegada = Math.max(30, Math.abs(tx - mx) * 0.5)
  return [
    `M ${sx},${sy}`,
    `C ${sx + alcaDaSaida},${sy} ${mx - alcaDaSaida},${my} ${mx},${my}`,
    `C ${mx + alcaDaChegada},${my} ${tx - alcaDaChegada},${ty} ${tx},${ty}`,
  ].join(' ')
}

/**
 * A linha entre dois blocos: com um **✕ no meio** e **puxável**.
 *
 * Duas coisas faltavam. Não havia como desfazer uma ligação, o jeito de "apagar
 * o link" era apagar um dos blocos e refazer o trabalho; e não havia como
 * desviar a linha, então num fluxo com muitos ramos elas cruzavam por cima dos
 * cartões e não dava para seguir nenhuma com o olho.
 *
 * O ✕ aparece de leve sempre e acende no ponteiro, linha de fluxo com um botão
 * aceso em cada uma vira campo de minas visual.
 *
 * O desvio é o mesmo gesto do FigJam: **a linha inteira é a alça**. Arrastar em
 * qualquer ponto dela sobe ou desce o caminho, dois cliques devolvem ao
 * automático. Não há bolinha de controle no meio: ela brigaria com o ✕ pelo
 * mesmo pixel, e obrigaria a mirar num alvo de 8px para começar o gesto.
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
  data,
}: EdgeProps) {
  const acoes = useContext(AcaoDaAresta)
  const { screenToFlowPosition } = useReactFlow()
  const [arrastando, setArrastando] = useState(false)

  /**
   * De onde o gesto partiu, e qual era o desvio naquele instante.
   *
   * O desvio novo é sempre `base + (ponteiro agora − ponteiro no início)`, nunca
   * a posição absoluta do ponteiro: assim a linha não salta para debaixo do
   * cursor quando o gesto começa longe do traço, e a conta já sai em
   * coordenadas do desenho, então o zoom não muda a sensibilidade.
   */
  const gesto = useRef<{ de: Desvio; base: Desvio } | null>(null)

  const desvio = (data?.desvio ?? null) as Desvio | null

  const [caminhoAutomatico, meioAutomaticoX, meioAutomaticoY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const meioX = (sourceX + targetX) / 2 + (desvio?.x ?? 0)
  const meioY = (sourceY + targetY) / 2 + (desvio?.y ?? 0)

  const caminho = desvio
    ? caminhoDesviado(sourceX, sourceY, targetX, targetY, meioX, meioY)
    : caminhoAutomatico

  const rotuloX = desvio ? meioX : meioAutomaticoX
  const rotuloY = desvio ? meioY : meioAutomaticoY

  function pegar(evento: PointerEvent<SVGPathElement>) {
    if (evento.button !== 0) return
    // Sem isto o React Flow entende o gesto como "arrastar a tela", e o fluxo
    // inteiro anda junto com a linha.
    evento.stopPropagation()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    const ponteiro = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
    gesto.current = { de: ponteiro, base: desvio ?? { x: 0, y: 0 } }
    setArrastando(true)
  }

  function mover(evento: PointerEvent<SVGPathElement>) {
    const emCurso = gesto.current
    if (!emCurso) return
    const ponteiro = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
    acoes?.desviar(id, {
      x: emCurso.base.x + (ponteiro.x - emCurso.de.x),
      y: emCurso.base.y + (ponteiro.y - emCurso.de.y),
    })
  }

  function soltar(evento: PointerEvent<SVGPathElement>) {
    if (!gesto.current) return
    evento.currentTarget.releasePointerCapture(evento.pointerId)
    gesto.current = null
    setArrastando(false)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={caminho}
        markerEnd={markerEnd}
        interactionWidth={26}
        style={{
          ...style,
          strokeWidth: selected || arrastando ? 2.5 : 1.5,
          stroke:
            selected || arrastando
              ? 'var(--color-primary, #38bdf8)'
              : (style?.stroke ?? '#5b6577'),
        }}
      />

      {/*
        A faixa que recebe o gesto. Fica por cima do traço, invisível e larga:
        o traço tem 1,5px e mirar nele é teste de pontaria. `nodrag`/`nopan`
        porque, sem eles, o React Flow reivindica o mesmo arrasto para mover a
        tela. O cursor é `ns-resize` porque o que se organiza aqui é altura de
        linha, e é ele que avisa, antes do clique, que a linha se mexe.
      */}
      <path
        d={caminho}
        fill="none"
        stroke="transparent"
        strokeWidth={26}
        className="nodrag nopan"
        style={{ pointerEvents: 'stroke', cursor: arrastando ? 'grabbing' : 'ns-resize' }}
        onPointerDown={pegar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onDoubleClick={(evento) => {
          evento.stopPropagation()
          acoes?.desviar(id, null)
        }}
      >
        <title>
          {desvio
            ? 'Arraste para mover esta ligação; dois cliques devolvem ao caminho automático'
            : 'Arraste para mover esta ligação'}
        </title>
      </path>

      <EdgeLabelRenderer>
        <div
          // `pointer-events-none` no contêiner e `auto` no botão: o rótulo cobre
          // um retângulo inteiro em cima do desenho, e sem isso ele engoliria o
          // clique de quem só queria arrastar a tela por ali.
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${rotuloX}px, ${rotuloY}px)`,
          }}
          className="nodrag nopan pointer-events-none"
        >
          <button
            type="button"
            title="Apagar esta ligação"
            aria-label="Apagar esta ligação"
            onClick={(evento) => {
              evento.stopPropagation()
              acoes?.apagar(id)
            }}
            // Fica de leve à mostra sempre, e acende no ponteiro. Só no hover
            // ninguém descobre que dá para apagar a ligação, foi exatamente o
            // que aconteceu: a saída conhecida era apagar um dos blocos.
            // Some durante o arrasto: no meio do gesto ele fica debaixo do
            // ponteiro e vira um botão de apagar esperando um clique acidental.
            className={`flex size-[20px] items-center justify-center rounded-full border border-line bg-panel text-[10px] text-muted transition hover:scale-110 hover:border-rose-400/50 hover:bg-rose-400/15 hover:text-perigo ${
              arrastando
                ? 'pointer-events-none opacity-0'
                : selected
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-auto opacity-30 hover:opacity-100'
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
