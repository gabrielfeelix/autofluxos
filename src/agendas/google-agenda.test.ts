import { describe, expect, it } from 'vitest'
import { conectorGoogleAgenda } from './google-agenda'

const token = async () => ({ ok: true as const, valor: 't' })

function falso(eventos: unknown[], registro: { url: string; init?: RequestInit }[] = []) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    registro.push({ url: String(url), ...(init ? { init } : {}) })
    if (init?.method === 'POST') {
      const corpo = JSON.parse(String(init.body)) as { start: { dateTime: string } }
      return new Response(JSON.stringify({ id: 'ev1', status: 'confirmed', start: corpo.start }), { status: 200 })
    }
    return new Response(JSON.stringify({ items: eventos }), { status: 200 })
  }
}

describe('Google Agenda', () => {
  it('livre é o expediente menos o ocupado, e evento "livre" não ocupa', async () => {
    const agenda = conectorGoogleAgenda(token, { inicio: '09:00', fim: '12:00', dias: '0,1,2,3,4,5,6' }, falso([
      { status: 'confirmed', start: { dateTime: '2099-01-05T10:00:00-03:00' }, end: { dateTime: '2099-01-05T11:00:00-03:00' } },
      { status: 'confirmed', transparency: 'transparent', start: { date: '2099-01-05' }, end: { date: '2099-01-06' } },
    ]))
    const r = await agenda.horarios({ de: '2099-01-05', ate: '2099-01-05' })
    expect(r.ok && r.valor.horarios.map((h) => h.hora)).toEqual(['09:00', '11:00'])
  })

  it('fora dos dias de atendimento não há horário', async () => {
    // 2099-01-04 é domingo; o padrão é segunda a sexta.
    const r = await conectorGoogleAgenda(token, {}, falso([])).horarios({ de: '2099-01-04', ate: '2099-01-04' })
    expect(r.ok && r.valor.horarios).toEqual([])
  })

  it('marcar cria o evento com a pessoa nas propriedades privadas', async () => {
    const registro: { url: string; init?: RequestInit }[] = []
    const r = await conectorGoogleAgenda(token, {}, falso([], registro)).marcar('2099-01-05T10:00', { telefone: '5544999990000', nome: 'Ana' })
    expect(r.ok && r.valor).toMatchObject({ marcacaoId: 'ev1', data: '2099-01-05', hora: '10:00' })
    const corpo = JSON.parse(String(registro.find((c) => c.init?.method === 'POST')?.init?.body))
    expect(corpo.extendedProperties.private.dialogon_contato).toBe('5544999990000')
    expect(corpo.summary).toBe('Horário: Ana')
  })

  it('marcar recusa horário que ficou ocupado', async () => {
    const ocupado = [{ status: 'confirmed', start: { dateTime: '2099-01-05T10:00:00-03:00' }, end: { dateTime: '2099-01-05T11:00:00-03:00' } }]
    const r = await conectorGoogleAgenda(token, {}, falso(ocupado)).marcar('2099-01-05T10:00', { telefone: '1', nome: 'Ana' })
    expect(r.ok).toBe(false)
  })
})
