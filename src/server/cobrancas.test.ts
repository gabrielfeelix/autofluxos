import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asaas } from '@/channels/asaas'
import { acharCobranca, mudarStatus, type CobrancaRegistrada } from './repos/cobrancas'
import { acessoDaConexao } from './repos/pagamentos'
import { emitirEvento } from './webhooks-de-saida'
import { aplicarPagamento, rodarVencimentoDeCobranca } from './cobrancas'

/**
 * Os webhooks de saída da cobrança (frente 4): sai um evento por mudança de
 * status, nunca por aviso do gateway. O aviso repetido não vira dois eventos.
 */

vi.mock('server-only', () => ({}))
vi.mock('@/channels/asaas', () => ({ asaas: { criarCobranca: vi.fn(), lerPagamento: vi.fn(), cancelarPagamento: vi.fn() } }))
vi.mock('@/channels/mercado-pago', () => ({ mercadoPago: {} }))
vi.mock('./adaptador-do-canal', () => ({ adaptadorDoCanal: vi.fn() }))
vi.mock('./alertar', () => ({ alertar: vi.fn() }))
vi.mock('./repos/campos', () => ({ gravarCampos: vi.fn() }))
vi.mock('./repos/cobrancas', () => ({
  acharCobranca: vi.fn(),
  apagarCobrancaQueNaoSaiu: vi.fn(),
  completarCobranca: vi.fn(),
  inserirCobranca: vi.fn(),
  mudarStatus: vi.fn(),
  saiuComoPedidoNativo: vi.fn().mockResolvedValue(false),
}))
vi.mock('./repos/conversas', () => ({ contextoDeResposta: vi.fn() }))
vi.mock('./repos/eventos', () => ({ anotar: vi.fn() }))
vi.mock('./repos/leads', () => ({ acharLead: vi.fn() }))
vi.mock('./repos/pagamentos', () => ({ acessoDaConexao: vi.fn(), conexaoAtiva: vi.fn() }))
vi.mock('./repos/tarefas', () => ({ agendar: vi.fn(), cancelarPorChave: vi.fn() }))
vi.mock('./recursos-do-plano', () => ({ recursoLiberado: vi.fn() }))
vi.mock('./webhooks-de-saida', () => ({ emitirEvento: vi.fn() }))

const CLIENTE = '11111111-1111-1111-1111-111111111111'

const COBRANCA: CobrancaRegistrada = {
  id: 'cb1',
  clienteId: CLIENTE,
  contatoId: 'c1',
  gateway: 'asaas',
  valorCentavos: 4990,
  descricao: 'Mensalidade',
  itens: null,
  status: 'pendente',
  pagamentoNoGateway: 'pay_1',
  preferenciaNoGateway: null,
  pixCopiaCola: '000201',
  link: 'https://www.asaas.com/i/1',
  venceEm: '2026-11-01T21:00:00.000Z',
  pagaEm: null,
  canceladaEm: null,
  origem: 'inbox',
  criadaPor: 'Ana',
  sessaoId: null,
  criadoEm: '2026-10-22T12:00:00.000Z',
}

const PAGA_EM = new Date('2026-10-23T15:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(acessoDaConexao).mockResolvedValue({ token: 't' } as never)
  vi.mocked(acharCobranca).mockResolvedValue(COBRANCA)
})

describe('cobranca.paga', () => {
  beforeEach(() => {
    vi.mocked(asaas.lerPagamento).mockResolvedValue({
      pagamentoId: 'pay_1',
      referencia: 'cb1',
      situacao: 'paga',
      valorCentavos: 4990,
      pagaEm: PAGA_EM,
    })
  })

  it('sai uma vez, com a cobrança já paga e o valor em reais', async () => {
    vi.mocked(mudarStatus).mockResolvedValue(true)
    expect(await aplicarPagamento(CLIENTE, 'asaas', 'pay_1')).toBe('paga')
    expect(emitirEvento).toHaveBeenCalledTimes(1)
    expect(emitirEvento).toHaveBeenCalledWith(CLIENTE, 'cobranca.paga', 'c1', {
      cobranca: expect.objectContaining({ id: 'cb1', valor: 49.9, status: 'paga', paga_em: PAGA_EM.toISOString(), gateway: 'asaas' }),
    })
  })

  it('aviso repetido do gateway não emite de novo', async () => {
    vi.mocked(mudarStatus).mockResolvedValue(false)
    expect(await aplicarPagamento(CLIENTE, 'asaas', 'pay_1')).toBe('paga')
    expect(emitirEvento).not.toHaveBeenCalled()
  })

  it('pago a menos não emite', async () => {
    vi.mocked(asaas.lerPagamento).mockResolvedValue({ pagamentoId: 'pay_1', referencia: 'cb1', situacao: 'paga', valorCentavos: 100, pagaEm: PAGA_EM })
    await aplicarPagamento(CLIENTE, 'asaas', 'pay_1')
    expect(mudarStatus).not.toHaveBeenCalled()
    expect(emitirEvento).not.toHaveBeenCalled()
  })
})

describe('cobranca.vencida', () => {
  beforeEach(() => {
    vi.mocked(asaas.lerPagamento).mockResolvedValue({ pagamentoId: 'pay_1', referencia: 'cb1', situacao: 'pendente', valorCentavos: 4990, pagaEm: null })
    vi.mocked(asaas.cancelarPagamento).mockResolvedValue(undefined)
  })

  it('sai quando o relógio vence a cobrança', async () => {
    vi.mocked(mudarStatus).mockResolvedValue(true)
    expect(await rodarVencimentoDeCobranca(CLIENTE, { cobrancaId: 'cb1' })).toBe('feita')
    expect(emitirEvento).toHaveBeenCalledWith(CLIENTE, 'cobranca.vencida', 'c1', {
      cobranca: expect.objectContaining({ id: 'cb1', status: 'vencida' }),
    })
  })

  it('não sai quando outro já mudou o status', async () => {
    vi.mocked(mudarStatus).mockResolvedValue(false)
    expect(await rodarVencimentoDeCobranca(CLIENTE, { cobrancaId: 'cb1' })).toBe('ignorada')
    expect(emitirEvento).not.toHaveBeenCalled()
  })
})
