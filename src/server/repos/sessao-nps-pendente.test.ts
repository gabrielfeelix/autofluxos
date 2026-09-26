import { describe, expect, it, vi } from 'vitest'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { executar } from '@/core/engine/executar'
import { sessaoNova } from '@/core/engine/types'

/**
 * A nota da pesquisa atravessa o banco entre a nota e o "por quê?".
 *
 * O defeito: o motor guardava `npsPendente` na sessão, mas `guardarSessao` não
 * gravava e `acharSessao`/`ultimaSessao` não liam. Nos testes do motor a sessão
 * passa de mão em mão na memória e tudo funcionava; na produção cada mensagem
 * relê a sessão do banco, o pendente chegava vazio, e o comentário da pessoa
 * voltava ao bloco como se fosse uma nota nova.
 *
 * Por isso o teste faz o caminho de verdade: grava, relê, executa de novo. O
 * banco é de mentira, uma linha de `sessions` em memória que só guarda as
 * colunas que o repositório manda, que é justamente o que importa provar.
 */
const linhas = vi.hoisted(() => new Map<string, Record<string, unknown>>())

vi.mock('../db', () => ({
  ehIdInvalido: () => false,
  db: () => ({
    from(tabela: string) {
      if (tabela !== 'sessions') throw new Error(`tabela inesperada: ${tabela}`)
      let id = ''
      let gravar: Record<string, unknown> | null = null
      let criar: Record<string, unknown> | null = null
      const consulta = {
        select: () => consulta,
        insert: (dados: Record<string, unknown>) => ((criar = dados), consulta),
        update: (dados: Record<string, unknown>) => ((gravar = dados), consulta),
        order: () => consulta,
        limit: () => consulta,
        eq: (coluna: string, valor: string) => {
          if (coluna === 'id') id = valor
          if (coluna === 'contact_id') id = [...linhas.keys()][0] ?? ''
          return consulta
        },
        single: async () => {
          const novo = { id: `s${linhas.size + 1}`, ...criar }
          linhas.set(novo.id, novo)
          return { data: novo, error: null }
        },
        maybeSingle: async () => ({ data: linhas.get(id) ?? null, error: null }),
        then: (ok: (r: unknown) => unknown) => {
          if (gravar) linhas.set(id, { ...linhas.get(id), ...gravar })
          return Promise.resolve({ error: null }).then(ok)
        },
      }
      return consulta
    },
  }),
}))

const { acharSessao, criarSessao, guardarSessao, ultimaSessao } = await import('./conversas')

const p = { x: 0, y: 0 }
const pesquisa: Fluxo = fluxoSchema.parse({
  inicio: 'nota',
  nodes: [
    {
      id: 'nota',
      type: 'nps',
      position: p,
      data: {
        texto: 'De 0 a 10?',
        salvarEm: 'nota',
        perguntaAberta: 'O que faltou?',
        comentarioEm: 'motivo',
      },
    },
    { id: 'fim', type: 'mensagem', position: p, data: { texto: 'Anotado.' } },
  ],
  edges: [
    { id: 'e1', source: 'nota', sourceHandle: 'promotor', target: 'fim' },
    { id: 'e2', source: 'nota', sourceHandle: 'neutro', target: 'fim' },
    { id: 'e3', source: 'nota', sourceHandle: 'detrator', target: 'fim' },
  ],
})

describe('a nota pendente da pesquisa passa pelo banco', () => {
  it('o "por quê?" relido do banco vira comentário, não nota nova', async () => {
    linhas.clear()
    const perguntou = executar(pesquisa, sessaoNova(), { tipo: 'inicio' })
    const salva = await criarSessao('contato', 'canal', 'versao', perguntou.sessao)

    const nota = executar(pesquisa, (await acharSessao(salva.id))!.sessao, {
      tipo: 'texto',
      texto: '3',
    })
    await guardarSessao(salva.id, nota.sessao)

    // A mensagem seguinte chega pelo webhook, que relê a sessão do banco.
    const relida = (await ultimaSessao('contato', 'canal'))!.sessao
    expect(relida.npsPendente).toEqual({ nota: 3, noId: 'nota', salvarEm: 'motivo' })

    const comentario = executar(pesquisa, relida, { tipo: 'texto', texto: '8' })
    expect(comentario.acoes.filter((a) => a.tipo === 'guardar_nota')).toHaveLength(0)
    expect(comentario.acoes).toContainEqual({ tipo: 'guardar_comentario', comentario: '8' })

    // E o pendente respondido some da linha, senão a próxima conversa cairia nele.
    await guardarSessao(salva.id, comentario.sessao)
    expect((await acharSessao(salva.id))!.sessao.npsPendente).toBeFalsy()
  })
})
