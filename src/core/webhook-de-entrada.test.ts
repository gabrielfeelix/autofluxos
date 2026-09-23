import { describe, expect, it } from 'vitest'
import { dataDaChamada, estadoDoWebhook } from './webhook-de-entrada'

describe('estadoDoWebhook', () => {
  it('sem chamada nenhuma é "nunca"', () => {
    expect(estadoDoWebhook({ ultimaEm: null, recusadaEm: null })).toEqual({ tipo: 'nunca' })
  })

  it('só aceita é "autenticada"', () => {
    expect(estadoDoWebhook({ ultimaEm: '2026-09-23T17:00:00Z', recusadaEm: null })).toEqual({ tipo: 'autenticada', em: '2026-09-23T17:00:00Z' })
  })

  it('só recusada é "recusada"', () => {
    expect(estadoDoWebhook({ ultimaEm: null, recusadaEm: '2026-09-23T17:00:00Z' })).toEqual({ tipo: 'recusada', em: '2026-09-23T17:00:00Z' })
  })

  it('a mais recente ganha: consertar a assinatura depois da recusa volta a "autenticada"', () => {
    expect(estadoDoWebhook({ ultimaEm: '2026-09-23T18:00:00Z', recusadaEm: '2026-09-23T17:00:00Z' }).tipo).toBe('autenticada')
    expect(estadoDoWebhook({ ultimaEm: '2026-09-23T17:00:00Z', recusadaEm: '2026-09-23T18:00:00Z' }).tipo).toBe('recusada')
  })
})

describe('dataDaChamada', () => {
  it('mostra no horário de Brasília, mesmo quando em UTC já é o dia seguinte', () => {
    expect(dataDaChamada('2026-09-24T01:30:00Z')).toBe('23/09 às 22:30')
  })
})
