import { beforeAll, describe, expect, it } from 'vitest'
import { criarTokenDoEntregador, lerTokenDoEntregador } from './token'

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= 'segredo-de-teste-do-entregador'
})

const dados = { clienteId: '11111111-1111-4111-8111-111111111111', pedidoId: '22222222-2222-4222-8222-222222222222' }

describe('token do entregador', () => {
  it('ida e volta', () => {
    const lido = lerTokenDoEntregador(criarTokenDoEntregador(dados))
    expect(lido).toMatchObject({ ok: true, dados })
  })

  it('um caractere trocado é inválido', () => {
    const token = criarTokenDoEntregador(dados)
    const trocado = token.slice(0, 5) + (token[5] === 'A' ? 'B' : 'A') + token.slice(6)
    expect(lerTokenDoEntregador(trocado)).toEqual({ ok: false, motivo: 'invalido' })
    expect(lerTokenDoEntregador('qualquer-coisa')).toEqual({ ok: false, motivo: 'invalido' })
  })

  it('25 horas depois está vencido', () => {
    const agora = new Date('2026-10-27T12:00:00Z')
    const token = criarTokenDoEntregador(dados, agora)
    expect(lerTokenDoEntregador(token, new Date(agora.getTime() + 25 * 3_600_000))).toEqual({ ok: false, motivo: 'vencido' })
    expect(lerTokenDoEntregador(token, new Date(agora.getTime() + 23 * 3_600_000)).ok).toBe(true)
  })
})
