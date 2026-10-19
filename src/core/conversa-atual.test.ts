import { describe, expect, it } from 'vitest'
import type { Fluxo } from './flow/schema'
import { recortarConversaAtual, semDecisoesAntigas } from './conversa-atual'

const em = (iso: string) => ({ ts: iso })

describe('recorte da conversa atual', () => {
  it('corta na pausa de 24h: a conversa de meses atrás não entra', () => {
    const msgs = [em('2024-10-19T10:00:00Z'), em('2024-10-19T10:05:00Z'), em('2026-10-19T17:40:00Z'), em('2026-10-19T18:09:00Z')]
    expect(recortarConversaAtual(msgs, null).map((m) => m.ts)).toEqual(['2026-10-19T17:40:00Z', '2026-10-19T18:09:00Z'])
  })
  it('corta na abertura da conversa pelo bot, com folga para a mensagem que a abriu', () => {
    const msgs = [em('2026-10-19T09:00:00Z'), em('2026-10-19T17:40:27Z'), em('2026-10-19T18:09:00Z')]
    const abertaEm = new Date('2026-10-19T17:40:31Z')
    expect(recortarConversaAtual(msgs, abertaEm).map((m) => m.ts)).toEqual(['2026-10-19T17:40:27Z', '2026-10-19T18:09:00Z'])
  })
  it('conversa contínua fica inteira', () => {
    const msgs = [em('2026-10-19T17:40:00Z'), em('2026-10-19T17:50:00Z'), em('2026-10-19T18:09:00Z')]
    expect(recortarConversaAtual(msgs, null)).toHaveLength(3)
  })
})

describe('retomada sem as decisões da conversa anterior', () => {
  const grafo = {
    nodes: [
      { id: 'menu', type: 'pergunta', data: { texto: 'Como posso ajudar?', opcoes: [{ id: 'comprar', rotulo: 'Quero comprar' }], salvarEm: 'assunto' } },
      { id: 'cpf', type: 'pergunta', data: { texto: 'Seu CPF?', opcoes: [], salvarEm: 'cpf' } },
      { id: 'triagem', type: 'ia', data: { salvarEm: 'ultima_resposta', conversar: { concluir: { salvarEm: 'assunto_ia' } } } },
    ],
    edges: [],
  } as unknown as Fluxo

  it('tira o botão tocado e a saída da IA, e mantém o que a pessoa informou (Sueli, PCYES)', () => {
    const vars = { nome: 'Sueli', telefone: '5511900000000', assunto: 'Quero comprar', assunto_ia: 'compra', ultima_resposta: 'x', cpf: '123' }
    expect(semDecisoesAntigas(vars, grafo)).toEqual({ nome: 'Sueli', telefone: '5511900000000', cpf: '123' })
  })
})
