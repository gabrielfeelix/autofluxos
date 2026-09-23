'use client'

import { Background, ReactFlow, ReactFlowProvider, type Edge, type Node } from '@xyflow/react'
import type { Comparacao } from '@/core/flow/comparar'
import type { Fluxo } from '@/core/flow/schema'
import { tiposDeNo } from './nos'

/**
 * Um desenho só para ler, com o que mudou pintado (A12).
 *
 * Provider próprio de propósito: o editor já tem o dele, e dois `ReactFlow` no
 * mesmo provider dividiriam a mesma lista de blocos, o de leitura passaria a
 * mexer no desenho de verdade.
 */
export function GrafoDeLeitura({ fluxo, comparacao }: { fluxo: Fluxo; comparacao: Comparacao }) {
  const novos = new Set(comparacao.acrescentados)
  const mudados = new Set(comparacao.alterados)

  const nodes: Node[] = fluxo.nodes.map((no) => ({
    ...no,
    draggable: false,
    selectable: false,
    connectable: false,
    className: novos.has(no.id)
      ? 'rounded-[14px] ring-2 ring-emerald-400'
      : mudados.has(no.id)
        ? 'rounded-[14px] ring-2 ring-amber-400'
        : '',
  })) as Node[]
  const edges: Edge[] = fluxo.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    type: 'smoothstep',
  }))

  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={tiposDeNo}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
