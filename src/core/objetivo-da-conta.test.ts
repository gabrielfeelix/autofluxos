import { describe, expect, it } from 'vitest'
import {
  cobra,
  desligarApagaDado,
  ehObjetivo,
  mostraCrm,
  nasceComCrm,
  OBJETIVOS,
  OBJETIVO_PADRAO,
  PASSOS_OPCIONAIS,
  ROTULO_DO_OBJETIVO,
  EXPLICA_O_OBJETIVO,
} from './objetivo-da-conta'

/**
 * O cenário que falhava antes desta tarefa, e é o ponto dela:
 *
 * a tela inicial cobrava "Organizar no funil" de todo mundo, então a conta que
 * abriu para atender com gente de verdade nunca terminava o onboarding. O teste
 * que prova a correção é o primeiro daqui.
 */
describe('o que o objetivo cobra', () => {
  it('quem só quer atender não é cobrado por funil nem por automação', () => {
    expect(cobra('atender', 'funil')).toBe(false)
    expect(cobra('atender', 'automacao')).toBe(false)
  })

  it('quem quer automatizar é cobrado pela automação, e não pelo funil', () => {
    expect(cobra('automatizar', 'automacao')).toBe(true)
    expect(cobra('automatizar', 'funil')).toBe(false)
  })

  it('quem quer vender é cobrado pelos dois', () => {
    expect(cobra('vender', 'automacao')).toBe(true)
    expect(cobra('vender', 'funil')).toBe(true)
  })

  it('existe pelo menos um objetivo que fecha o onboarding sem passo opcional', () => {
    // A garantia de que a barra de progresso pode chegar ao fim. Se algum dia
    // todo objetivo cobrar algo, este teste cai e a decisão volta à mesa.
    const fecha = OBJETIVOS.filter((o) => PASSOS_OPCIONAIS.every((p) => !cobra(o, p)))
    expect(fecha).toEqual(['atender'])
  })
})

describe('o CRM ao nascer', () => {
  it('só vender nasce com o CRM ligado', () => {
    expect(nasceComCrm('vender')).toBe(true)
    expect(nasceComCrm('atender')).toBe(false)
    expect(nasceComCrm('automatizar')).toBe(false)
  })

  it('o padrão de quem não respondeu não liga o CRM', () => {
    expect(nasceComCrm(OBJETIVO_PADRAO)).toBe(false)
  })
})

describe('mostrar o CRM no menu', () => {
  it('ligado aparece', () => {
    expect(mostraCrm({ ligado: true, temQuadro: false })).toBe(true)
  })

  it('quem já usa quadro continua vendo, mesmo sem ter ligado', () => {
    // O §4.2: "empresa atual que usa quadros mantém CRM visível na migração".
    // Sem isto, o interruptor novo esconderia a tela que alguém usa todo dia.
    expect(mostraCrm({ ligado: false, temQuadro: true })).toBe(true)
  })

  it('conta nova, sem quadro e sem ligar, não vê', () => {
    expect(mostraCrm({ ligado: false, temQuadro: false })).toBe(false)
  })
})

describe('desligar', () => {
  it('não apaga dado', () => {
    // A frase do §4.2 com um lugar onde ser testada.
    expect(desligarApagaDado()).toBe(false)
  })
})

describe('o vocabulário', () => {
  it('todo objetivo tem rótulo e explicação', () => {
    for (const objetivo of OBJETIVOS) {
      expect(ROTULO_DO_OBJETIVO[objetivo].length).toBeGreaterThan(0)
      expect(EXPLICA_O_OBJETIVO[objetivo].length).toBeGreaterThan(0)
    }
  })

  it('nenhum texto da escolha usa travessão', () => {
    // Regra da casa, e aqui ela pega: estes textos vão para a tela.
    for (const objetivo of OBJETIVOS) {
      expect(ROTULO_DO_OBJETIVO[objetivo]).not.toContain('—')
      expect(EXPLICA_O_OBJETIVO[objetivo]).not.toContain('—')
    }
  })

  it('recusa objetivo que não existe', () => {
    expect(ehObjetivo('crescer')).toBe(false)
    expect(ehObjetivo('')).toBe(false)
    expect(ehObjetivo(null)).toBe(false)
    expect(ehObjetivo('vender')).toBe(true)
  })
})
