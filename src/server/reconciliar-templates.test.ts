import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientesComTemplatesPendentes = vi.fn()
const casarPorNome = vi.fn().mockResolvedValue(true)
const listarCanais = vi.fn()
const lerTokenDoCanal = vi.fn().mockResolvedValue('token-do-cliente')
const listarTemplatesDaMeta = vi.fn()

vi.mock('./repos/templates', () => ({
  clientesComTemplatesPendentes: (...a: unknown[]) => clientesComTemplatesPendentes(...a),
  casarPorNome: (...a: unknown[]) => casarPorNome(...a),
}))
vi.mock('./repos/conversas', () => ({
  listarCanais: (...a: unknown[]) => listarCanais(...a),
  lerTokenDoCanal: (...a: unknown[]) => lerTokenDoCanal(...a),
}))
vi.mock('@/channels/templates-api', () => ({
  listarTemplatesDaMeta: (...a: unknown[]) => listarTemplatesDaMeta(...a),
}))

const { reconciliarTemplates } = await import('./reconciliar-templates')

const CANAL_ATIVO = [{ provider: 'cloud-api', status: 'ativo', id: 'ch1' }]

beforeEach(() => {
  vi.clearAllMocks()
  clientesComTemplatesPendentes.mockResolvedValue([{ clienteId: 'c1', wabaId: 'w1' }])
  listarCanais.mockResolvedValue(CANAL_ATIVO)
  lerTokenDoCanal.mockResolvedValue('token-do-cliente')
  casarPorNome.mockResolvedValue(true)
  listarTemplatesDaMeta.mockResolvedValue({
    ok: true,
    templates: [
      {
        wabaTemplateId: '999',
        nome: 'lembrete',
        idioma: 'pt_BR',
        status: 'aprovado',
        categoria: 'UTILITY',
        qualidade: 'GREEN',
        motivoRecusa: null,
      },
    ],
  })
})

describe('a reconciliação', () => {
  /*
   * O caso que ela existe para consertar: o webhook com o id se perdeu, então
   * casar por id não acharia nada. `(cliente, nome, idioma)` é a única chave
   * que sobrevive a essa perda — e de quebra grava o id que faltava.
   */
  it('casa por nome e idioma, e grava o id que faltava', async () => {
    const r = await reconciliarTemplates()

    expect(casarPorNome).toHaveBeenCalledWith(
      'c1',
      'lembrete',
      'pt_BR',
      expect.objectContaining({ status: 'aprovado', wabaTemplateId: '999' }),
    )
    expect(r.corrigidos).toBe(1)
    expect(r.conferidos).toBe(1)
  })

  it('grava o motivo quando a Meta recusou', async () => {
    listarTemplatesDaMeta.mockResolvedValue({
      ok: true,
      templates: [
        {
          wabaTemplateId: '999',
          nome: 'lembrete',
          idioma: 'pt_BR',
          status: 'recusado',
          categoria: null,
          qualidade: null,
          motivoRecusa: 'INVALID_FORMAT',
        },
      ],
    })

    await reconciliarTemplates()

    expect(casarPorNome.mock.calls[0]![3].motivoRecusa).toBe('INVALID_FORMAT')
  })

  it('não apaga o motivo que o webhook já tinha trazido', async () => {
    // O webhook traz descrição E recomendação; a listagem traz só o código
    // seco. Sobrescrever perderia a melhor informação que a Meta dá.
    await reconciliarTemplates()

    expect(casarPorNome.mock.calls[0]![3]).not.toHaveProperty('motivoRecusa')
  })

  it('ignora status que esta versão não conhece', async () => {
    listarTemplatesDaMeta.mockResolvedValue({
      ok: true,
      templates: [
        {
          wabaTemplateId: '1',
          nome: 'x',
          idioma: 'pt_BR',
          status: 'desconhecido',
          categoria: null,
          qualidade: null,
          motivoRecusa: null,
        },
      ],
    })

    const r = await reconciliarTemplates()

    expect(casarPorNome).not.toHaveBeenCalled()
    expect(r.conferidos).toBe(1)
    expect(r.corrigidos).toBe(0)
  })

  /*
   * Erro da Meta não é "este cliente não tem template". Tratar como lista
   * vazia faria a reconciliação concluir o oposto da verdade.
   */
  it('conta falha quando a Meta recusa, sem concluir lista vazia', async () => {
    listarTemplatesDaMeta.mockResolvedValue({
      ok: false,
      erro: { codigo: 190, mensagem: 'token expirou' },
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const r = await reconciliarTemplates()

    expect(r.falhas).toBe(1)
    expect(casarPorNome).not.toHaveBeenCalled()
  })

  it('uma conta que falha não derruba as outras', async () => {
    clientesComTemplatesPendentes.mockResolvedValue([
      { clienteId: 'c1', wabaId: 'w1' },
      { clienteId: 'c2', wabaId: 'w2' },
    ])
    listarTemplatesDaMeta
      .mockResolvedValueOnce({ ok: false, erro: { codigo: 190, mensagem: 'token' } })
      .mockResolvedValueOnce({
        ok: true,
        templates: [
          {
            wabaTemplateId: '2',
            nome: 'outro',
            idioma: 'pt_BR',
            status: 'aprovado',
            categoria: null,
            qualidade: null,
            motivoRecusa: null,
          },
        ],
      })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const r = await reconciliarTemplates()

    expect(r.falhas).toBe(1)
    expect(r.corrigidos).toBe(1)
  })

  it('pula cliente sem número de WhatsApp ativo, sem contar falha', async () => {
    // Cliente que só usa Instagram não tem template para reconciliar.
    listarCanais.mockResolvedValue([{ provider: 'instagram', status: 'ativo' }])

    const r = await reconciliarTemplates()

    expect(listarTemplatesDaMeta).not.toHaveBeenCalled()
    expect(r.falhas).toBe(0)
  })

  it('não faz nada quando ninguém tem template pendente', async () => {
    clientesComTemplatesPendentes.mockResolvedValue([])

    const r = await reconciliarTemplates()

    expect(r).toEqual({ clientes: 0, conferidos: 0, corrigidos: 0, falhas: 0 })
  })
})
