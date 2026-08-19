import { describe, expect, it } from 'vitest'
import {
  atendimentoAberto,
  emMinutos,
  proximaAbertura,
  SEMPRE_ABERTO,
  type HorarioDeAtendimento,
} from './horario'

/**
 * O expediente decide o que a pessoa ouve quando o bot desiste às 3h da manhã.
 * Errar aqui não dá erro em lugar nenhum: dá silêncio, e silêncio é o que faz
 * um lead sumir.
 */

/** Estúdio que abre das 8h às 12h e das 13h30 às 18h, de segunda a sexta. */
const COMERCIAL: HorarioDeAtendimento = {
  fuso: 'America/Sao_Paulo',
  dias: [
    [],
    [{ de: '08:00', ate: '12:00' }, { de: '13:30', ate: '18:00' }],
    [{ de: '08:00', ate: '12:00' }, { de: '13:30', ate: '18:00' }],
    [{ de: '08:00', ate: '12:00' }, { de: '13:30', ate: '18:00' }],
    [{ de: '08:00', ate: '12:00' }, { de: '13:30', ate: '18:00' }],
    [{ de: '08:00', ate: '12:00' }, { de: '13:30', ate: '18:00' }],
    [],
  ],
}

/** Quarta-feira, 18/ago/2026. O `Z` deixa a conta explícita: UTC−3 no Brasil. */
const quarta = (horaUtc: string) => new Date(`2026-08-19T${horaUtc}Z`)

describe('ler a hora', () => {
  it('aceita o que é hora e recusa o que não é', () => {
    expect(emMinutos('08:30')).toBe(510)
    expect(emMinutos('00:00')).toBe(0)
    expect(emMinutos('23:59')).toBe(1439)
    expect(emMinutos('24:00')).toBeNull()
    expect(emMinutos('8:30')).toBeNull()
    expect(emMinutos('')).toBeNull()
  })
})

describe('tem gente para atender agora?', () => {
  it('sem nada configurado, atende sempre', () => {
    // É como o produto se comportou até aqui, e é o que a coluna vazia
    // significa para todo cliente que já existe. Tratar vazio como "fechado
    // sempre" faria o produto emudecer sozinho no dia da migration.
    expect(atendimentoAberto(SEMPRE_ABERTO, quarta('06:00:00'))).toBe(true)
  })

  it('dentro da faixa, sim', () => {
    // 13h UTC = 10h em São Paulo.
    expect(atendimentoAberto(COMERCIAL, quarta('13:00:00'))).toBe(true)
  })

  it('no almoço, não', () => {
    // 15h30 UTC = 12h30 em São Paulo, entre as duas faixas.
    expect(atendimentoAberto(COMERCIAL, quarta('15:30:00'))).toBe(false)
  })

  it('às 3h da manhã, não — que é o caso que motivou tudo isto', () => {
    expect(atendimentoAberto(COMERCIAL, quarta('06:00:00'))).toBe(false)
  })

  it('no fim de semana, não', () => {
    // Sábado, 22/ago/2026, meio-dia em São Paulo.
    expect(atendimentoAberto(COMERCIAL, new Date('2026-08-22T15:00:00Z'))).toBe(false)
  })

  it('o fuso é o da conta, não o do servidor', () => {
    // A Vercel roda em UTC. Às 23h UTC de quarta já são 20h em São Paulo —
    // fechado. Lendo o relógio do processo, o servidor diria que está aberto.
    expect(atendimentoAberto(COMERCIAL, quarta('23:00:00'))).toBe(false)

    // E a mesma instante num fuso diferente dá outra resposta, que é o ponto.
    const lisboa: HorarioDeAtendimento = { ...COMERCIAL, fuso: 'Europe/Lisbon' }
    expect(atendimentoAberto(lisboa, quarta('09:00:00'))).toBe(true)
  })

  it('faixa invertida ou ilegível fecha, não abre', () => {
    // Prometer alguém que não existe é pior do que dizer que está fechado.
    const torto: HorarioDeAtendimento = {
      fuso: 'America/Sao_Paulo',
      dias: [[], [], [], [{ de: '18:00', ate: '08:00' }], [], [], []],
    }
    expect(atendimentoAberto(torto, quarta('13:00:00'))).toBe(false)
  })

  it('o limite de cima é exclusivo: às 18h em ponto já fechou', () => {
    expect(atendimentoAberto(COMERCIAL, quarta('20:59:00'))).toBe(true)
    expect(atendimentoAberto(COMERCIAL, quarta('21:00:00'))).toBe(false)
  })
})

describe('quando abre de novo', () => {
  it('mais tarde hoje, quando ainda há faixa pela frente', () => {
    // 15h30 UTC = 12h30 em São Paulo: o almoço acaba às 13h30.
    expect(proximaAbertura(COMERCIAL, quarta('15:30:00'))).toBe('hoje a partir das 13:30')
  })

  it('amanhã, quando o dia já acabou', () => {
    // 23h UTC = 20h em São Paulo.
    expect(proximaAbertura(COMERCIAL, quarta('23:00:00'))).toBe('amanhã a partir das 08:00')
  })

  it('atravessa o fim de semana e diz o dia', () => {
    // Sábado ao meio-dia em São Paulo: o próximo é segunda.
    expect(proximaAbertura(COMERCIAL, new Date('2026-08-22T15:00:00Z'))).toBe(
      'segunda a partir das 08:00',
    )
  })

  it('sem horário configurado não promete nada', () => {
    // Quem atende sempre não tem "abre de novo" para dizer.
    expect(proximaAbertura(SEMPRE_ABERTO, quarta('06:00:00'))).toBeNull()
  })

  it('faixa invertida não é anunciada — as duas funções concordam sobre o que vale', () => {
    // `atendimentoAberto` já recusava esta faixa. Anunciá-la aqui prometeria um
    // horário em que ninguém vai responder, que é pior do que não prometer.
    const torto: HorarioDeAtendimento = {
      fuso: 'America/Sao_Paulo',
      dias: [[], [], [], [{ de: '18:00', ate: '08:00' }], [], [], []],
    }
    expect(atendimentoAberto(torto, quarta('23:00:00'))).toBe(false)
    expect(proximaAbertura(torto, quarta('06:00:00'))).toBeNull()
  })
})
