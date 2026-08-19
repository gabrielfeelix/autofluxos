import { describe, expect, it } from 'vitest'
import { JANELA_MS } from '@/channels/janela'
import {
  ATRASO_MAXIMO_MINUTOS,
  LIMITE_DE_PASSOS,
  cabeNaJanela,
  comoAtraso,
  conferirAtraso,
  passoDoIndice,
  passosEmOrdem,
  quandoRodaOPasso,
  type PassoDaSequencia,
} from './sequencias'

/**
 * A régua das sequências.
 *
 * O que estes testes prendem não é aritmética — é o desenho de produto que a
 * aritmética carrega: a ordem sai do tempo e não da criação, o horário conta do
 * evento e não do agora, e o teto de 24h é a janela da Meta e não uma
 * preferência que dê para afrouxar.
 */

const passo = (atrasoMinutos: number, id = String(atrasoMinutos)): PassoDaSequencia => ({
  id,
  atrasoMinutos,
  fluxoId: 'f',
})

describe('a ordem dos passos sai do tempo', () => {
  it('ordena pelo atraso, não pela ordem de criação', () => {
    // Quem acrescenta um passo de 30min depois de já ter um de 6h está
    // inserindo no meio. Ordenar pela criação mandaria a mensagem de 6h antes.
    const passos = [passo(360), passo(30), passo(120)]
    expect(passosEmOrdem(passos).map((p) => p.atrasoMinutos)).toEqual([30, 120, 360])
  })

  it('o índice anda sobre a lista ordenada', () => {
    const passos = [passo(360), passo(30)]
    expect(passoDoIndice(passos, 0)!.atrasoMinutos).toBe(30)
    expect(passoDoIndice(passos, 1)!.atrasoMinutos).toBe(360)
    expect(passoDoIndice(passos, 2)).toBeNull()
  })
})

describe('o horário conta do evento, não do agora', () => {
  it('soma o atraso ao instante em que a pessoa entrou', () => {
    const entrou = new Date('2026-08-19T10:00:00Z')
    expect(quandoRodaOPasso(entrou, passo(120)).toISOString()).toBe('2026-08-19T12:00:00.000Z')
  })

  it('o segundo passo não herda o atraso do primeiro', () => {
    // É o ponto inteiro do offset absoluto: uma passada do agendador que
    // demorou não pode empurrar a sequência toda para a frente e jogar o
    // último passo para fora da janela de 24h.
    const entrou = new Date('2026-08-19T10:00:00Z')
    const segundo = quandoRodaOPasso(entrou, passo(1200))
    expect(segundo.toISOString()).toBe('2026-08-20T06:00:00.000Z')
  })
})

describe('o teto de 24h é a janela da Meta', () => {
  it('o máximo é exatamente a janela', () => {
    expect(ATRASO_MAXIMO_MINUTOS).toBe(JANELA_MS / 60_000)
  })

  it('recusa passo além da janela, e diz por quê', () => {
    const r = conferirAtraso(ATRASO_MAXIMO_MINUTOS + 1, [])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('modelo aprovado pela Meta')
  })

  it('aceita o limite exato', () => {
    expect(conferirAtraso(ATRASO_MAXIMO_MINUTOS, []).ok).toBe(true)
  })

  it('cabeNaJanela olha o que restava quando a pessoa entrou', () => {
    // Meia janela consumida: um passo de 20h já não entrega.
    const metade = JANELA_MS / 2
    expect(cabeNaJanela(passo(600), metade)).toBe(true)
    expect(cabeNaJanela(passo(1200), metade)).toBe(false)
  })
})

describe('a régua de um passo novo', () => {
  it('recusa tempo zero ou quebrado', () => {
    expect(conferirAtraso(0, []).ok).toBe(false)
    expect(conferirAtraso(1.5, []).ok).toBe(false)
  })

  it('recusa dois passos no mesmo minuto', () => {
    // Duas mensagens ao mesmo tempo no WhatsApp de alguém, sem ordem definida.
    const r = conferirAtraso(120, [120])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('mesmo tempo')
  })

  it('recusa o passo além do teto de passos', () => {
    const cheios = Array.from({ length: LIMITE_DE_PASSOS }, (_, i) => (i + 1) * 10)
    expect(conferirAtraso(999, cheios).ok).toBe(false)
  })
})

describe('como o tempo é escrito na tela', () => {
  it('minutos, horas e horas com sobra', () => {
    expect(comoAtraso(30)).toBe('30min')
    expect(comoAtraso(120)).toBe('2h')
    expect(comoAtraso(150)).toBe('2h30')
    expect(comoAtraso(1440)).toBe('24h')
  })
})
