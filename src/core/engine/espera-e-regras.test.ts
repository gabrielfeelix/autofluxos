import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { ATENDIMENTO_SEMPRE_ABERTO, executar } from './executar'
import { sessaoNova } from './types'

const p = { x: 0, y: 0 }

const comEspera: Fluxo = fluxoSchema.parse({
  inicio: 'guia',
  nodes: [
    { id: 'guia', type: 'mensagem', position: p, data: { texto: 'Aqui está o guia.' } },
    { id: 'espera', type: 'espera', position: p, data: { quantidade: 5, unidade: 'minutos' } },
    { id: 'depois', type: 'mensagem', position: p, data: { texto: 'Gostou do guia?' } },
  ],
  edges: [
    { id: 'a', source: 'guia', target: 'espera' },
    { id: 'b', source: 'espera', target: 'depois' },
  ],
})

describe('bloco Esperar', () => {
  it('para no bloco e só segue no prazo', () => {
    const r = executar(comEspera, sessaoNova(), { tipo: 'inicio' })
    expect(r.acoes).toEqual([{ tipo: 'enviar_texto', texto: 'Aqui está o guia.' }])
    expect(r.sessao.noAtual).toBe('espera')
    expect(r.sessao.status).toBe('ativa')

    const acordou = executar(comEspera, r.sessao, { tipo: 'timeout' })
    expect(acordou.acoes).toContainEqual({ tipo: 'enviar_texto', texto: 'Gostou do guia?' })
  })

  it('o que a pessoa escreve durante a espera não move a conversa', () => {
    const r = executar(comEspera, sessaoNova(), { tipo: 'inicio' })
    const escreveu = executar(comEspera, r.sessao, { tipo: 'texto', texto: 'oi, ainda não li' })
    expect(escreveu.acoes).toEqual([])
    expect(escreveu.sessao.noAtual).toBe('espera')

    const foto = executar(comEspera, r.sessao, { tipo: 'midia', formato: 'image' })
    expect(foto.acoes).toEqual([])
    expect(foto.sessao.status).toBe('ativa')
  })
})

function condicao(dados: Record<string, unknown>): Fluxo {
  return fluxoSchema.parse({
    inicio: 'c',
    nodes: [
      { id: 'c', type: 'condicao', position: p, data: dados },
      { id: 'sim', type: 'mensagem', position: p, data: { texto: 'sim' } },
      { id: 'nao', type: 'mensagem', position: p, data: { texto: 'não' } },
    ],
    edges: [
      { id: 'a', source: 'c', target: 'sim', sourceHandle: 'verdadeiro' },
      { id: 'b', source: 'c', target: 'nao', sourceHandle: 'falso' },
    ],
  })
}

const disse = (f: Fluxo, contexto = ATENDIMENTO_SEMPRE_ABERTO) =>
  executar(f, sessaoNova(), { tipo: 'inicio' }, contexto).acoes.flatMap((a) => (a.tipo === 'enviar_texto' ? [a.texto] : []))

describe('condição com regras', () => {
  it('a regra única antiga continua decidindo igual', () => {
    const f = condicao({ variavel: 'plano', operador: 'vazio', valor: '' })
    expect(disse(f)).toEqual(['sim'])
  })

  it('etiqueta: tem e não tem', () => {
    const tem = condicao({ regras: [{ tipo: 'etiqueta', etiquetaId: 'vip', tem: true }] })
    expect(disse(tem, { ...ATENDIMENTO_SEMPRE_ABERTO, etiquetas: ['vip'] })).toEqual(['sim'])
    expect(disse(tem, ATENDIMENTO_SEMPRE_ABERTO)).toEqual(['não'])

    const naoTem = condicao({ regras: [{ tipo: 'etiqueta', etiquetaId: 'vip', tem: false }] })
    expect(disse(naoTem, ATENDIMENTO_SEMPRE_ABERTO)).toEqual(['sim'])
  })

  it('todas exige as duas; qualquer uma basta uma', () => {
    const regras = [
      { tipo: 'horario', aberto: true },
      { tipo: 'canal', canal: 'site' },
    ]
    const ctx = { ...ATENDIMENTO_SEMPRE_ABERTO, canal: 'whatsapp' }
    expect(disse(condicao({ regras, modo: 'todas' }), ctx)).toEqual(['não'])
    expect(disse(condicao({ regras, modo: 'qualquer' }), ctx)).toEqual(['sim'])
  })

  it('a etiqueta posta antes, na mesma execução, já conta', () => {
    const f: Fluxo = fluxoSchema.parse({
      inicio: 'e',
      nodes: [
        { id: 'e', type: 'etiqueta', position: p, data: { etiquetaId: 'clicou' } },
        { id: 'c', type: 'condicao', position: p, data: { regras: [{ tipo: 'etiqueta', etiquetaId: 'clicou', tem: true }] } },
        { id: 'sim', type: 'mensagem', position: p, data: { texto: 'sim' } },
      ],
      edges: [
        { id: 'a', source: 'e', target: 'c' },
        { id: 'b', source: 'c', target: 'sim', sourceHandle: 'verdadeiro' },
      ],
    })
    expect(disse(f)).toContain('sim')
  })

  it('etapa e horário fechado', () => {
    const f = condicao({ regras: [{ tipo: 'etapa', colunaId: 'col-1', esta: true }, { tipo: 'horario', aberto: false }] })
    expect(disse(f, { atendimentoAberto: false, proximaAbertura: null, colunas: ['col-1'] })).toEqual(['sim'])
  })
})
