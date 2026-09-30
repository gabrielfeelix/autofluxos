import { describe, expect, it } from 'vitest'
import { executar } from './executar'
import { sessaoNova } from './types'
import type { Fluxo } from '../flow/schema'

const fluxo = {
  inicio: 'menu',
  nodes: [
    {
      id: 'menu',
      type: 'pergunta',
      position: { x: 0, y: 0 },
      data: { texto: 'Olá! Como posso ajudar?', opcoes: [{ id: 'suporte', rotulo: 'Suporte' }, { id: 'pedido', rotulo: 'Meu pedido' }], salvarEm: 'assunto' },
    },
    { id: 'sup', type: 'mensagem', position: { x: 0, y: 0 }, data: { partes: [{ tipo: 'texto', texto: 'Fala com o suporte' }] } },
    { id: 'ped', type: 'mensagem', position: { x: 0, y: 0 }, data: { partes: [{ tipo: 'texto', texto: 'Qual o pedido?' }] } },
  ],
  edges: [
    { id: 'e1', source: 'menu', target: 'sup', sourceHandle: 'suporte' },
    { id: 'e2', source: 'menu', target: 'ped', sourceHandle: 'pedido' },
  ],
} as unknown as Fluxo

const textos = (acoes: { tipo: string; texto?: string }[]) => acoes.map((a) => `${a.tipo}:${a.texto ?? ''}`)

describe('conversa nova aberta pelo toque num menu antigo', () => {
  it('a opção tocada vale como resposta, sem repetir o menu', () => {
    const { acoes } = executar(fluxo, sessaoNova(), { tipo: 'inicio', opcaoId: 'suporte' })
    expect(textos(acoes)).toContain('enviar_texto:Fala com o suporte')
    expect(acoes.some((a) => a.tipo === 'enviar_opcoes')).toBe(false)
  })

  it('opção que o menu de hoje não tem recomeça pelo menu', () => {
    const { acoes } = executar(fluxo, sessaoNova(), { tipo: 'inicio', opcaoId: 'garantia-antiga' })
    expect(acoes.some((a) => a.tipo === 'enviar_opcoes')).toBe(true)
  })

  it('sem opção, o começo de sempre', () => {
    const { acoes } = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    expect(acoes.some((a) => a.tipo === 'enviar_opcoes')).toBe(true)
  })
})
