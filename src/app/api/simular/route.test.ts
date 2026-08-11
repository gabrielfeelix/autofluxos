import { describe, expect, it } from 'vitest'
import { sessaoNova } from '@/core/engine/types'
import { triagem } from '@/exemplos/triagem'
import { POST } from './route'

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
})
