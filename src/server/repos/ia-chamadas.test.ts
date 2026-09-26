import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A cota de IA do contato, com o banco de mentira.
 *
 * O que importa provar é o lado da falha: leitura que dá erro vira "sem
 * limite", nunca "esgotado", porque o limite não pode derrubar o atendimento.
 */

type Resposta = { data?: unknown; count?: number | null; error?: { message: string } | null }
const respostas = vi.hoisted(() => ({ clients: {} as Resposta, ia_chamadas: {} as Resposta }))
const filtros = vi.hoisted(() => [] as unknown[][])

vi.mock('../db', () => ({
  db: () => ({
    from(tabela: 'clients' | 'ia_chamadas') {
      const consulta = {
        select: () => consulta,
        eq: (...args: unknown[]) => (filtros.push(['eq', ...args]), consulta),
        gte: (...args: unknown[]) => (filtros.push(['gte', ...args]), consulta),
        maybeSingle: async () => respostas[tabela],
        then: (ok: (r: Resposta) => unknown) => Promise.resolve(respostas[tabela]).then(ok),
      }
      return consulta
    },
  }),
}))

const { cotaDeIaDoContato } = await import('./ia-chamadas')

beforeEach(() => {
  filtros.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('cotaDeIaDoContato', () => {
  it('conta só as respostas do contato nas últimas 24 h', async () => {
    respostas.clients = { data: { ia_limite_contato_dia: 20 }, error: null }
    respostas.ia_chamadas = { count: 7, error: null }

    expect(await cotaDeIaDoContato('c1', 'p1')).toEqual({ limite: 20, usadas: 7 })
    expect(filtros).toContainEqual(['eq', 'contato_id', 'p1'])
    expect(filtros).toContainEqual(['eq', 'ferramenta', 'resposta'])
    const desde = filtros.find((f) => f[0] === 'gte')?.[2] as string
    expect(Date.now() - Date.parse(desde)).toBeGreaterThanOrEqual(24 * 60 * 60 * 1_000 - 1_000)
  })

  it('conta sem limite nem conta nada', async () => {
    respostas.clients = { data: { ia_limite_contato_dia: null }, error: null }

    expect(await cotaDeIaDoContato('c1', 'p1')).toEqual({ limite: null, usadas: 0 })
    expect(filtros.some((f) => f[0] === 'gte')).toBe(false)
  })

  it('erro ao ler o limite é sem limite', async () => {
    respostas.clients = { data: null, error: { message: 'caiu' } }
    expect(await cotaDeIaDoContato('c1', 'p1')).toEqual({ limite: null, usadas: 0 })
  })

  it('erro ao contar é sem limite', async () => {
    respostas.clients = { data: { ia_limite_contato_dia: 5 }, error: null }
    respostas.ia_chamadas = { count: null, error: { message: 'timeout' } }
    expect(await cotaDeIaDoContato('c1', 'p1')).toEqual({ limite: null, usadas: 0 })
  })
})
