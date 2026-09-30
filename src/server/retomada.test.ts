import { describe, expect, it } from 'vitest'
import { ehRetomada } from './receber-mensagem'

const agora = Date.parse('2026-09-30T15:00:00Z')
const encerrada = (minutosAtras: number) => ({
  sessao: { status: 'encerrada' },
  atualizadoEm: new Date(agora - minutosAtras * 60_000).toISOString(),
})
const texto = (t: string) => ({ tipo: 'texto' as const, texto: t })

describe('retomada da conversa que acabou de terminar', () => {
  it('texto pouco depois do fim é retomada', () => {
    expect(ehRetomada(encerrada(5), texto('obrigado'), {}, agora)).toBe(true)
  })
  it('depois de duas horas é conversa nova', () => {
    expect(ehRetomada(encerrada(121), texto('oi'), {}, agora)).toBe(false)
  })
  it('INICIO pede o menu inteiro', () => {
    expect(ehRetomada(encerrada(5), texto('inicio'), {}, agora)).toBe(false)
  })
  it('gatilho e campanha abrem o fluxo deles', () => {
    expect(ehRetomada(encerrada(5), texto('promo'), { gatilhoId: 'g' }, agora)).toBe(false)
    expect(ehRetomada(encerrada(5), texto('promo'), { campanhaId: 'c' }, agora)).toBe(false)
  })
  it('conversa ainda viva, com gente, ou primeira vez não é retomada', () => {
    expect(ehRetomada({ ...encerrada(5), sessao: { status: 'ativa' } }, texto('x'), {}, agora)).toBe(false)
    expect(ehRetomada({ ...encerrada(5), sessao: { status: 'humano' } }, texto('x'), {}, agora)).toBe(false)
    expect(ehRetomada(null, texto('x'), {}, agora)).toBe(false)
  })
})
