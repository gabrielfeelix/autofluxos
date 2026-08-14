import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { triagem } from '@/exemplos/triagem'
import { consumirLimite } from '@/server/limite'
import { POST } from './route'

vi.mock('@/server/limite', () => ({
  chaveDeLimite: vi.fn(() => 'simular:127.0.0.1'),
  consumirLimite: vi.fn(),
}))

function pedir(corpo: unknown) {
  return POST(
    new Request('http://localhost/api/simular', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
  )
}

describe('POST /api/simular', () => {
  beforeEach(() => {
    vi.mocked(consumirLimite).mockResolvedValue(true)
  })

  it('começa a conversa e devolve ações mais a sessão', async () => {
    const resposta = await pedir({ fluxo: triagem, sessao: sessaoNova(), entrada: { tipo: 'inicio' } })
    expect(resposta.status).toBe(200)

    const corpo = await resposta.json()
    expect(corpo.sessao.noAtual).toBe('tipo')
    expect(corpo.acoes.some((a: { tipo: string }) => a.tipo === 'enviar_opcoes')).toBe(true)
  })

  it('continua de onde parou quando recebe a sessão de volta', async () => {
    const inicio = await (await pedir({ fluxo: triagem, sessao: sessaoNova(), entrada: { tipo: 'inicio' } })).json()

    const resposta = await pedir({
      fluxo: triagem,
      sessao: inicio.sessao,
      entrada: { tipo: 'opcao', opcaoId: 'casamento' },
    })

    const corpo = await resposta.json()
    expect(corpo.sessao.vars.tipo).toBe('Casamento')
    expect(corpo.sessao.noAtual).toBe('nome')
  })

  it('recusa corpo que não é JSON', async () => {
    const resposta = await POST(
      new Request('http://localhost/api/simular', { method: 'POST', body: 'nada disso' }),
    )
    expect(resposta.status).toBe(400)
  })

  it('recusa fluxo inválido em vez de deixar chegar no motor', async () => {
    const resposta = await pedir({
      fluxo: { inicio: 'x', nodes: [], edges: [] },
      sessao: sessaoNova(),
      entrada: { tipo: 'inicio' },
    })
    expect(resposta.status).toBe(400)
  })

  it('recusa entrada de tipo desconhecido', async () => {
    const resposta = await pedir({
      fluxo: triagem,
      sessao: sessaoNova(),
      entrada: { tipo: 'telepatia' },
    })
    expect(resposta.status).toBe(400)
  })

  it('recusa corpo acima de 256 KB antes de analisar ou executar', async () => {
    const resposta = await POST(
      new Request('http://localhost/api/simular', {
        method: 'POST',
        body: 'x'.repeat(300 * 1024),
      }),
    )

    expect(resposta.status).toBe(413)
  })

  it('recusa fluxo com mais de 200 nós antes de executar efeitos', async () => {
    const fluxo = structuredClone(triagem)
    const primeiro = fluxo.nodes[0]
    if (!primeiro) throw new Error('o exemplo precisa ter um nó')
    fluxo.nodes = Array.from({ length: 201 }, (_, indice) => ({
      ...primeiro,
      id: `no-${indice}`,
    }))

    const resposta = await pedir({ fluxo, sessao: sessaoNova(), entrada: { tipo: 'inicio' } })
    expect(resposta.status).toBe(413)
  })

  it('recusa quem excedeu o limite antes de executar o simulador', async () => {
    vi.mocked(consumirLimite).mockResolvedValue(false)

    const resposta = await pedir({ fluxo: triagem, sessao: sessaoNova(), entrada: { tipo: 'inicio' } })
    expect(resposta.status).toBe(429)
  })
})
