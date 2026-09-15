import { describe, expect, it } from 'vitest'
import { diaDaMensagem, etiquetasDeDia, horaDoRelogio, rotuloDoDia } from './quando'

/**
 * O fuso é o miolo destes testes, não um detalhe.
 *
 * O painel é de um negócio brasileiro e o servidor é da Vercel. Uma mensagem
 * das 22h em São Paulo já é do dia seguinte em UTC — agrupar por UTC colocaria
 * a conversa da noite debaixo da etiqueta errada, e ninguém perceberia porque
 * o erro só aparece depois das 21h.
 */

/** 15/set/2026, 22:30 em São Paulo — já é dia 16 em UTC. */
const NOITE_DE_SP = '2026-09-16T01:30:00.000Z'
/** 15/set/2026, 09:14 em São Paulo. */
const MANHA_DE_SP = '2026-09-15T12:14:00.000Z'

describe('diaDaMensagem', () => {
  it('agrupa pelo dia de São Paulo, e não pelo de UTC', () => {
    expect(diaDaMensagem(NOITE_DE_SP)).toBe('2026-09-15')
  })

  it('manhã e noite do mesmo dia caem na mesma chave', () => {
    expect(diaDaMensagem(MANHA_DE_SP)).toBe(diaDaMensagem(NOITE_DE_SP))
  })
})

describe('horaDoRelogio', () => {
  it('mostra a hora de quem atende, não a do servidor', () => {
    expect(horaDoRelogio(MANHA_DE_SP)).toBe('09:14')
    expect(horaDoRelogio(NOITE_DE_SP)).toBe('22:30')
  })
})

describe('rotuloDoDia', () => {
  const agora = new Date('2026-09-15T18:00:00.000Z').getTime()

  it('diz Hoje e Ontem em vez da data', () => {
    expect(rotuloDoDia(MANHA_DE_SP, agora)).toBe('Hoje')
    expect(rotuloDoDia('2026-09-14T12:00:00.000Z', agora)).toBe('Ontem')
  })

  /*
   * A noite de São Paulo é o caso que quebra uma implementação ingênua: em UTC
   * ela já virou o dia seguinte, e um `toISOString().slice(0,10)` diria "Ontem"
   * para uma mensagem de hoje à noite.
   */
  it('a mensagem das 22:30 de hoje ainda é Hoje', () => {
    const tardeDaNoite = new Date('2026-09-16T02:00:00.000Z').getTime()
    expect(rotuloDoDia(NOITE_DE_SP, tardeDaNoite)).toBe('Hoje')
  })

  it('dia mais velho vira data por extenso, sem ano quando é o ano corrente', () => {
    expect(rotuloDoDia('2026-09-01T12:00:00.000Z', agora)).toBe('01 de setembro')
  })

  it('ano diferente carrega o ano, porque sem ele é ambíguo', () => {
    expect(rotuloDoDia('2025-09-01T12:00:00.000Z', agora)).toContain('2025')
  })
})

describe('etiquetasDeDia', () => {
  const agora = new Date('2026-09-15T18:00:00.000Z').getTime()
  const ts = (iso: string) => ({ ts: iso })

  it('marca só a primeira mensagem de cada dia', () => {
    const itens = [
      ts('2026-09-13T12:00:00.000Z'),
      ts('2026-09-13T13:00:00.000Z'),
      ts('2026-09-14T12:00:00.000Z'),
      ts('2026-09-15T12:00:00.000Z'),
      ts('2026-09-15T13:00:00.000Z'),
    ]
    expect(etiquetasDeDia(itens, (i) => i.ts, agora)).toEqual([
      '13 de setembro',
      null,
      'Ontem',
      'Hoje',
      null,
    ])
  })

  it('a primeira mensagem da conversa sempre abre um dia', () => {
    expect(etiquetasDeDia([ts(MANHA_DE_SP)], (i) => i.ts, agora)).toEqual(['Hoje'])
  })

  it('conversa vazia não produz etiqueta nenhuma', () => {
    expect(etiquetasDeDia([], (i: { ts: string }) => i.ts, agora)).toEqual([])
  })

  /*
   * Duas mensagens que cruzam a meia-noite de São Paulo precisam de etiqueta
   * entre elas, mesmo separadas por poucos minutos.
   */
  it('separa 23:58 de 00:03, que são dias diferentes', () => {
    const itens = [ts('2026-09-15T02:58:00.000Z'), ts('2026-09-15T03:03:00.000Z')]
    const etiquetas = etiquetasDeDia(itens, (i) => i.ts, agora)
    expect(etiquetas[0]).not.toBeNull()
    expect(etiquetas[1]).not.toBeNull()
  })
})
