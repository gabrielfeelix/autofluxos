import { describe, expect, it } from 'vitest'
import { validar } from '@/core/flow/validar'
import { MODELOS } from './modelos'

/**
 * **Todo modelo tem que publicar.**
 *
 * Um modelo que produz um fluxo inválido é pior do que não existir: a pessoa
 * escolhe, acha que resolveu, e a primeira coisa que vê ao clicar em Publicar é
 * uma lista de erros sobre um desenho que ela não fez.
 */
describe('os modelos de fluxo', () => {
  it.each(MODELOS.map((modelo) => modelo.id))('%s nasce válido', (id) => {
    const modelo = MODELOS.find((m) => m.id === id)!
    const conferido = validar(modelo.grafo, { iaHabilitada: false, conexoes: [] })

    expect(conferido.ok, JSON.stringify(conferido.ok ? [] : conferido.erros)).toBe(true)
  })

  it('nenhum usa IA — ela é plano à parte e o validador recusaria', () => {
    for (const modelo of MODELOS) {
      expect(modelo.grafo.nodes.some((no) => no.type === 'ia')).toBe(false)
    }
  })

  it('todos têm saída para uma pessoa', () => {
    // É a regra que `publicar()` cobra, e a que impede um fluxo de virar um
    // beco onde alguém fica preso conversando com um robô.
    for (const modelo of MODELOS) {
      expect(modelo.grafo.nodes.some((no) => no.type === 'handoff')).toBe(true)
    }
  })
})
