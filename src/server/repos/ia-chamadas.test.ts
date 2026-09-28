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

const { cotaDeIaDoContato, cotaDeIaDaConta, LIMITE_PADRAO_POR_CONTATO } = await import('./ia-chamadas')

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

  it('conta sem limite escolhido cai no padrão, e conta', async () => {
    respostas.clients = { data: { ia_limite_contato_dia: null }, error: null }
    respostas.ia_chamadas = { count: 3, error: null }

    expect(await cotaDeIaDoContato('c1', 'p1')).toEqual({ limite: LIMITE_PADRAO_POR_CONTATO, usadas: 3 })
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

describe('cotaDeIaDaConta', () => {
  it('teto pelo preço contratado, contando a conta inteira em 30 dias', async () => {
    respostas.clients = { data: { plano: 'essencial', preco_contratado: 597 }, error: null }
    respostas.ia_chamadas = { count: 120, error: null }

    expect(await cotaDeIaDaConta('c1')).toEqual({ teto: 2985, usadas: 120 })
    expect(filtros.some((f) => f[1] === 'contato_id')).toBe(false)
    const desde = filtros.find((f) => f[0] === 'gte')?.[2] as string
    expect(Date.now() - Date.parse(desde)).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1_000 - 1_000)
  })

  it('sem preço contratado, usa o do plano, com piso', async () => {
    respostas.clients = { data: { plano: 'essencial', preco_contratado: null }, error: null }
    respostas.ia_chamadas = { count: 0, error: null }
    expect(await cotaDeIaDaConta('c1')).toEqual({ teto: 1500, usadas: 0 })
  })

  it('erro ao ler é sem teto', async () => {
    respostas.clients = { data: null, error: { message: 'caiu' } }
    expect(await cotaDeIaDaConta('c1')).toEqual({ teto: null, usadas: 0 })
  })
})
