import { describe, expect, it } from 'vitest'
import { compararGrafos, semDiferenca } from './comparar'
import { fluxoSchema } from './schema'

const p = { x: 0, y: 0 }
const base = fluxoSchema.parse({
  inicio: 'oi',
  nodes: [
    { id: 'oi', type: 'mensagem', position: p, data: { texto: 'Olá!' } },
    { id: 'fim', type: 'handoff', position: p, data: {} },
  ],
  edges: [{ id: 'e1', source: 'oi', target: 'fim' }],
})

describe('compararGrafos', () => {
  it('mover bloco de lugar não é mudança', () => {
    const movido = { ...base, nodes: base.nodes.map((n) => ({ ...n, position: { x: 300, y: 90 } })) }
    expect(semDiferenca(compararGrafos(base, movido))).toBe(true)
  })

  it('separa acrescentado, removido e alterado pelo id do bloco', () => {
    const depois = fluxoSchema.parse({
      inicio: 'oi',
      nodes: [
        { id: 'oi', type: 'mensagem', position: p, data: { texto: 'Olá, tudo bem?' } },
        { id: 'tag', type: 'etiqueta', position: p, data: { etiquetaId: 'x' } },
      ],
      edges: [{ id: 'e1', source: 'oi', target: 'tag' }],
    })
    expect(compararGrafos(base, depois)).toEqual({
      acrescentados: ['tag'],
      removidos: ['fim'],
      alterados: ['oi'],
      caminhoMudou: true,
    })
  })

  it('religar sem mexer em bloco muda só o caminho', () => {
    const religado = fluxoSchema.parse({ ...base, edges: [{ id: 'outra', source: 'fim', target: 'oi' }] })
    expect(compararGrafos(base, religado)).toEqual({
      acrescentados: [],
      removidos: [],
      alterados: [],
      caminhoMudou: true,
    })
  })
})
