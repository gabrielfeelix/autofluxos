import { describe, expect, it } from 'vitest'
import { respostasDoNumero } from './papeis-do-numero'

const publicado = { id: 'f1', versaoPublicadaId: 'v1' }
const rascunho = { id: 'f2', versaoPublicadaId: null }

describe('respostasDoNumero', () => {
  it('conta só papel com fluxo publicado', () => {
    const r = respostasDoNumero(
      { principal: 'f1', boasVindas: 'f1', midia: 'f2', posAtendimento: null },
      [publicado, rascunho],
    )
    expect(r.respondendo).toBe(2)
    expect(r.total).toBe(4)
    expect(r.calados).toEqual([
      { papel: 'midia', motivo: 'rascunho', fluxoId: 'f2' },
      { papel: 'posAtendimento', motivo: 'sem_fluxo', fluxoId: null },
    ])
  })

  it('fluxo apagado conta como sem fluxo', () => {
    const r = respostasDoNumero(
      { principal: 'sumiu', boasVindas: 'f1', midia: 'f1', posAtendimento: 'f1' },
      [publicado],
    )
    expect(r.respondendo).toBe(3)
    expect(r.calados).toEqual([{ papel: 'principal', motivo: 'sem_fluxo', fluxoId: null }])
  })
})
