import { describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'

/**
 * A automação enviada no meio de um atendimento devolve a conversa (0169).
 *
 * O banco é de mentira, mas respeita os filtros `eq` do update: a volta só
 * pode acontecer na sessão marcada, e só uma vez.
 */
const linhas = vi.hoisted(() => new Map<string, Record<string, unknown>>())

vi.mock('../db', () => ({
  ehIdInvalido: () => false,
  db: () => ({
    from() {
      const filtros: [string, unknown][] = []
      let gravar: Record<string, unknown> | null = null
      let criar: Record<string, unknown> | null = null
      const consulta = {
        select: () => consulta,
        insert: (dados: Record<string, unknown>) => ((criar = dados), consulta),
        update: (dados: Record<string, unknown>) => ((gravar = dados), consulta),
        eq: (coluna: string, valor: unknown) => (filtros.push([coluna, valor]), consulta),
        single: async () => {
          const novo = { id: `s${linhas.size + 1}`, devolver_a_equipe: false, ...criar }
          linhas.set(novo.id, novo)
          return { data: novo, error: null }
        },
        then: (ok: (r: unknown) => unknown) => {
          if (gravar) {
            for (const [id, linha] of linhas) {
              const bate = filtros.every(([c, v]) => (c === 'id' ? id === v : linha[c] === v))
              if (bate) linhas.set(id, { ...linha, ...gravar })
            }
          }
          return Promise.resolve({ error: null }).then(ok)
        },
      }
      return consulta
    },
  }),
}))

const { criarSessao, guardarSessao } = await import('./conversas')

describe('sessão que devolve a conversa à equipe', () => {
  it('fluxo terminado volta para humano e apaga a marca', async () => {
    const salva = await criarSessao('c1', 'canal', 'v1', sessaoNova(), true)
    await guardarSessao(salva.id, { ...sessaoNova(), status: 'encerrada' })
    expect(linhas.get(salva.id)).toMatchObject({ status: 'humano', devolver_a_equipe: false })

    // Devolvida ao bot depois e terminada de novo: agora encerra de verdade.
    await guardarSessao(salva.id, { ...sessaoNova(), status: 'encerrada' })
    expect(linhas.get(salva.id)).toMatchObject({ status: 'encerrada' })
  })

  it('sem a marca, o fim do fluxo encerra', async () => {
    const salva = await criarSessao('c2', 'canal', 'v1', sessaoNova())
    await guardarSessao(salva.id, { ...sessaoNova(), status: 'encerrada' })
    expect(linhas.get(salva.id)).toMatchObject({ status: 'encerrada', devolver_a_equipe: false })
  })

  it('no meio do fluxo, nada muda', async () => {
    const salva = await criarSessao('c3', 'canal', 'v1', sessaoNova(), true)
    await guardarSessao(salva.id, { ...sessaoNova(), status: 'ativa' })
    expect(linhas.get(salva.id)).toMatchObject({ status: 'ativa', devolver_a_equipe: true })
  })
})
