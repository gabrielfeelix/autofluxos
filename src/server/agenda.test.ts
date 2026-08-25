import { afterEach, describe, expect, it, vi } from 'vitest'
import { conferirChaveDaAgenda } from './agenda'

/**
 * A conferência existe porque "está ligado?" não tinha resposta em tela nenhuma:
 * a chave era colada, guardada no cofre, e se estivesse errada ninguém descobria
 * ali — o erro aparecia no meio de uma conversa de verdade, como um handoff sem
 * explicação, com a credencial cadastrada e com cara de pronta no painel.
 */
const responder = (corpo: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }),
  )

afterEach(() => vi.restoreAllMocks())

describe('conferirChaveDaAgenda', () => {
  it('devolve o que a conta tem, que é a prova de qual conta é', async () => {
    responder({
      profissionais: [{ nome: 'Marina' }, { nome: 'Carol' }],
      servicos: [{ nome: 'Pilates solo' }],
      locais: [{ nome: 'Sala 1' }],
      vocabulario: { servico: { singular: 'Modalidade' } },
    })

    const r = await conferirChaveDaAgenda('vr_chave')
    expect(r).toEqual({
      ok: true,
      profissionais: ['Marina', 'Carol'],
      servicos: ['Pilates solo'],
      locais: ['Sala 1'],
      comoChamaServico: 'Modalidade',
    })
  })

  it('manda a chave como bearer, e para o endereço da agenda', async () => {
    const espiao = responder({})
    await conferirChaveDaAgenda('vr_chave')

    const [url, opcoes] = espiao.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/catalogo')
    expect((opcoes.headers as Record<string, string>).authorization).toBe('Bearer vr_chave')
  })

  /*
   * O erro mais comum é colar a coisa errada — o id da conta, uma URL, o
   * segredo do webhook. Dizer isso antes da rede custa zero e evita esperar
   * oito segundos para ouvir "recusada".
   */
  it('pega a cola errada antes de gastar uma viagem', async () => {
    const espiao = responder({})
    const r = await conferirChaveDaAgenda('https://verandi.4yu.com.br')

    expect(r.ok).toBe(false)
    expect(espiao).not.toHaveBeenCalled()
  })

  it('401 é chave recusada, e não "a agenda caiu"', async () => {
    responder({ erro: 'chave de API ausente ou inválida' }, 401)
    const r = await conferirChaveDaAgenda('vr_errada')

    expect(r).toEqual({ ok: false, motivo: 'a chave foi recusada. Gere outra e cole de novo.' })
  })

  // A mensagem do erro de rede às vezes carrega o endereço inteiro, e não ajuda
  // quem está olhando a tela.
  it('agenda fora do ar vira frase, e não o erro cru', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:443'))
    const r = await conferirChaveDaAgenda('vr_chave')

    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.motivo).not.toContain('10.0.0.1')
  })

  it('catálogo vazio ainda é sucesso — é conta nova, não chave errada', async () => {
    responder({ profissionais: [], servicos: [] })
    const r = await conferirChaveDaAgenda('vr_chave')

    expect(r).toMatchObject({ ok: true, profissionais: [], servicos: [] })
  })
})
