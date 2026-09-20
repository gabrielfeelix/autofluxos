import { beforeEach, describe, expect, it, vi } from 'vitest'
const { exigir, rpc, revalidar } = vi.hoisted(() => ({ exigir: vi.fn(), rpc: vi.fn(), revalidar: vi.fn() }))
vi.mock('./permissoes', () => ({ exigirCapacidade: exigir, recusou: (r: { ok?: boolean }) => r.ok === false }))
vi.mock('./db', () => ({ db: () => ({ rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
import { acaoPrepararConta } from './acoes-onboarding'
import { RESPOSTAS_INICIAIS } from '@/core/onboarding'

beforeEach(() => { vi.clearAllMocks(); exigir.mockResolvedValue({ regras: {} }) })
describe('autorização e preparação', () => {
  it('recusa membro sem capacidade antes de tocar nos dados', async () => {
    exigir.mockResolvedValue({ ok: false, erro: 'Sem permissão' })
    expect((await acaoPrepararConta('empresa', RESPOSTAS_INICIAIS, 'concluir')).ok).toBe(false)
    expect(exigir).toHaveBeenCalledWith('empresa', 'configurar_operacao', 'todos')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('não aceita grafo ou modelo arbitrário vindo do navegador', async () => {
    await acaoPrepararConta('empresa', { ...RESPOSTAS_INICIAIS, grafo: {} }, 'concluir')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('salvar rascunho não prepara modelos nem publica', async () => {
    rpc.mockResolvedValue({ data: { status: 'rascunho', respostas: RESPOSTAS_INICIAIS }, error: null })
    expect((await acaoPrepararConta('empresa', RESPOSTAS_INICIAIS, 'salvar')).ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('preparar_onboarding', expect.objectContaining({ p_cliente: 'empresa', p_quadro: null, p_fluxo: null }))
  })
  it('concluir escolhe os grafos no servidor', async () => {
    const respostas = { ...RESPOSTAS_INICIAIS, objetivo: 'vendas', atendimento: 'hibrido', funil: 'comercial', chatbot: 'recado' }
    rpc.mockResolvedValue({ data: { status: 'concluido', respostas }, error: null })
    expect((await acaoPrepararConta('empresa', respostas, 'concluir')).ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('preparar_onboarding', expect.objectContaining({ p_objetivo: 'vender', p_quadro: expect.objectContaining({ finalidade: 'comercial' }), p_fluxo: expect.objectContaining({ grafo: expect.objectContaining({ nodes: expect.any(Array) }) }) }))
  })
  it('erros não vazam mensagem do banco nem confirmam sucesso', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'detalhes internos' } })
    const resultado = await acaoPrepararConta('empresa', RESPOSTAS_INICIAIS, 'concluir')
    expect(resultado.ok).toBe(false)
    expect(JSON.stringify(resultado)).not.toContain('detalhes internos')
    expect(revalidar).not.toHaveBeenCalled()
  })
})
