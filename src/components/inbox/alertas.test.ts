import { describe, expect, it } from 'vitest'
import { idsDosAlertas, novosAlertas, type AlertaDaFila } from './alertas'

const primeiro: AlertaDaFila = {
  id: 'contato-1:2026-08-14T10:00:00.000Z',
  contatoId: 'contato-1',
  nome: 'Ana',
  motivo: 'pediu atendimento',
  desde: '2026-08-14T10:00:00.000Z',
}

describe('alertas do Inbox', () => {
  it('não interrompe por uma fila que já estava aberta na tela', () => {
    expect(novosAlertas([primeiro], idsDosAlertas([primeiro]))).toEqual([])
  })

  it('avisa um handoff novo, inclusive se o contato já teve outro antes', () => {
    const segundo = {
      ...primeiro,
      id: 'contato-1:2026-08-14T11:00:00.000Z',
      desde: '2026-08-14T11:00:00.000Z',
    }

    expect(novosAlertas([primeiro, segundo], idsDosAlertas([primeiro]))).toEqual([segundo])
  })
})
