import { beforeEach, describe, expect, it, vi } from 'vitest'

const leituras = vi.hoisted(() => ({
  teste: vi.fn(async (): Promise<string | null> => null),
  assinatura: vi.fn(async (): Promise<{ estado: string | null } | null> => null),
}))

vi.mock('./repos/plano', () => ({ planoDaConta: vi.fn(async () => 'operacao'), testeDaConta: leituras.teste }))
vi.mock('./repos/planos', () => ({
  planoVigente: vi.fn(async () => ({ id: 'operacao', nome: 'Operação', recursos: ['crm', 'ia', 'transmissoes', 'integracoes'] })),
}))
vi.mock('./repos/faturas-da-conta', () => ({ assinaturaDaConta: leituras.assinatura }))

const { recursosDaOrganizacao, recusaDoPlano } = await import('./recursos-do-plano')

beforeEach(() => vi.clearAllMocks())

describe('a pausa por mensalidade em atraso', () => {
  it('em dia, tudo do plano vale', async () => {
    leituras.assinatura.mockResolvedValueOnce({ estado: 'ativa' })
    expect((await recursosDaOrganizacao('c-ativa')).recursos).toEqual(['crm', 'ia', 'transmissoes', 'integracoes'])
  })

  it('suspensa (dia 10) ainda não pausa recurso: só o painel fecha', async () => {
    leituras.assinatura.mockResolvedValueOnce({ estado: 'suspensa' })
    expect((await recursosDaOrganizacao('c-suspensa')).recursos).toContain('ia')
  })

  it('pausada (dia 30) fica só com o CRM, e a recusa diz o motivo', async () => {
    leituras.assinatura.mockResolvedValue({ estado: 'pausada' })
    expect((await recursosDaOrganizacao('c-pausada')).recursos).toEqual(['crm'])
    expect(await recusaDoPlano('c-pausada', 'ia')).toMatch(/mensalidade está em atraso/)
  })

  it('erro ao ler a assinatura não trava nada', async () => {
    leituras.assinatura.mockRejectedValueOnce(new Error('banco fora'))
    expect((await recursosDaOrganizacao('c-erro')).recursos).toContain('ia')
  })
})
