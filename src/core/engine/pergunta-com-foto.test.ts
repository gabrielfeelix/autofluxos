import { describe, expect, it } from 'vitest'
import { fluxoSchema } from '../flow/schema'
import { executar } from './executar'
import { sessaoNova } from './types'

const p = { x: 0, y: 0 }

/**
 * A foto em cima dos botões: o produto e o "Fazer pedido?" numa bolha só,
 * em vez de uma foto solta e uma pergunta solta embaixo.
 */
function comFoto(imagem: string | undefined, opcoes = ['Fazer pedido', 'Ver outro', 'Voltar']) {
  const fluxo = fluxoSchema.parse({
    inicio: 'q',
    nodes: [
      {
        id: 'q',
        type: 'pergunta',
        position: p,
        data: {
          texto: '*{{item}}*',
          opcoes: opcoes.map((r, i) => ({ id: `o${i}`, rotulo: r })),
          ...(imagem !== undefined ? { imagem } : {}),
        },
      },
    ],
    edges: [],
  })
  const s = { ...sessaoNova(), vars: { item: 'Pizza Calabresa', foto: 'https://x.test/calabresa.jpg' } }
  return executar(fluxo, s, { tipo: 'inicio' }).acoes.find((a) => a.tipo === 'enviar_opcoes')
}

describe('pergunta com foto', () => {
  it('leva a foto, com variável, junto dos botões', () => {
    expect(comFoto('{{foto}}')).toMatchObject({ formato: 'botoes', imagem: 'https://x.test/calabresa.jpg', texto: '*Pizza Calabresa*' })
  })

  it('sem foto, a pergunta é a de sempre', () => {
    expect(comFoto(undefined)).not.toHaveProperty('imagem')
  })

  it('variável vazia ou endereço sem https não vira foto', () => {
    expect(comFoto('{{nao_existe}}')).not.toHaveProperty('imagem')
    expect(comFoto('http://x.test/a.jpg')).not.toHaveProperty('imagem')
  })

  it('com lista, a foto segue na ação (quem envia manda antes, sozinha)', () => {
    const acao = comFoto('{{foto}}', ['a', 'b', 'c', 'd', 'e'])
    expect(acao).toMatchObject({ formato: 'lista', imagem: 'https://x.test/calabresa.jpg' })
  })
})
