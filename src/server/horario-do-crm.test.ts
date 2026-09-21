import { describe, expect, it } from 'vitest'
import { precisaSincronizar, VALIDADE_DA_COPIA_MS } from './horario-do-crm'
import type { HorarioDeAtendimento } from '@/core/horario'

const AGORA = new Date('2026-09-21T12:00:00Z')

const doCrm = (sincronizadoEm?: string): HorarioDeAtendimento => ({
  fuso: 'America/Sao_Paulo',
  dias: [[], [], [], [], [], [], []],
  origem: {
    tipo: 'crm',
    url: 'https://verandi.4yu.com.br/api/v1/funcionamento',
    ...(sincronizadoEm ? { sincronizadoEm } : {}),
  },
})

describe('quando refazer a cópia do expediente', () => {
  it('conta manual nunca busca nada lá fora', () => {
    const manual: HorarioDeAtendimento = {
      fuso: 'America/Sao_Paulo',
      dias: [[], [], [], [], [], [], []],
      origem: { tipo: 'manual' },
    }
    expect(precisaSincronizar(manual, AGORA)).toBe(false)
    expect(precisaSincronizar(null, AGORA)).toBe(false)
  })

  it('sem endereço não há o que buscar, e tentar seria bater em lugar nenhum', () => {
    expect(precisaSincronizar({ ...doCrm(), origem: { tipo: 'crm' } }, AGORA)).toBe(false)
  })

  it('cópia que nunca foi feita precisa ser feita', () => {
    expect(precisaSincronizar(doCrm(), AGORA)).toBe(true)
  })

  it('cópia fresca não paga a viagem', () => {
    const recente = new Date(AGORA.getTime() - VALIDADE_DA_COPIA_MS / 2).toISOString()
    expect(precisaSincronizar(doCrm(recente), AGORA)).toBe(false)
  })

  it('cópia velha é refeita', () => {
    const velha = new Date(AGORA.getTime() - VALIDADE_DA_COPIA_MS - 1000).toISOString()
    expect(precisaSincronizar(doCrm(velha), AGORA)).toBe(true)
  })

  it('data ilegível conta como velha, senão a cópia congela para sempre', () => {
    expect(precisaSincronizar(doCrm('ontem de tarde'), AGORA)).toBe(true)
  })
})
