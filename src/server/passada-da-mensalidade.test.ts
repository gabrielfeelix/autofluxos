import { beforeEach, describe, expect, it, vi } from 'vitest'

const asaas = vi.hoisted(() => ({
  mensalidadeConfigurada: vi.fn(() => true),
  cobrancaPorReferencia: vi.fn(async (): Promise<string | null> => null),
  criarCobrancaAvulsa: vi.fn(async () => 'pay_novo'),
  cancelarAssinatura: vi.fn(async () => undefined),
}))
const repos = vi.hoisted(() => ({
  contasQueAssinam: vi.fn(),
  faturasVencidasDeTodas: vi.fn(),
  gravarAssinatura: vi.fn(async () => undefined),
  definirSuspensao: vi.fn(async () => ({ ok: true })),
  marcarAviso: vi.fn(async () => true),
  enviarModelo: vi.fn(async () => true),
  consumoDeTodasAsContas: vi.fn(async () => [{ clienteId: 'c1', conversas: 3010 }]),
}))

vi.mock('@/channels/asaas-da-4yu', () => asaas)
vi.mock('./repos/faturas-da-conta', () => ({
  contasQueAssinam: repos.contasQueAssinam,
  faturasVencidasDeTodas: repos.faturasVencidasDeTodas,
  gravarAssinatura: repos.gravarAssinatura,
}))
vi.mock('./repos/organizacoes', () => ({ definirSuspensao: repos.definirSuspensao }))
vi.mock('./repos/avisos-de-plano', () => ({ marcarAviso: repos.marcarAviso }))
vi.mock('./repos/auditoria', () => ({ registrar: vi.fn(async () => undefined) }))
vi.mock('./email', () => ({ enviarModelo: repos.enviarModelo }))
vi.mock('./avisos-por-email', () => ({ gestoresDaConta: vi.fn(async () => [{ email: 'dono@x.test' }]) }))
vi.mock('./repos/plano', () => ({
  chaveDoMes: (d: Date) => `${d.toISOString().slice(0, 7)}-01`,
  consumoDeTodasAsContas: repos.consumoDeTodasAsContas,
}))
vi.mock('./repos/planos', () => ({
  planosVigentes: vi.fn(async () => [{ id: 'operacao', nome: 'Operação', conversas: 3000, precoExcedente: 0.4 }]),
}))

const { passadaDaMensalidade } = await import('./passada-da-mensalidade')

const conta = {
  clienteId: 'c1',
  nome: 'MGM Pilates',
  planoDaConta: 'operacao',
  suspensaEm: null as string | null,
  clienteAsaas: 'cus_1',
  assinaturaRef: 'sub_1',
  estado: 'ativa',
  plano: 'operacao',
  ciclo: 'mensal',
}
const vencida = (vencimento: string) => ({
  id: 'f1',
  clienteId: 'c1',
  tipo: 'mensalidade',
  valorCentavos: 59700,
  vencimento,
  estado: 'vencida',
  link: 'https://asaas.test/i/1',
  notaFiscalUrl: null,
  pagaEm: null,
})
// 12h em Brasília, para o dia não escorregar.
const dia = (d: string) => new Date(`${d}T15:00:00Z`)

beforeEach(() => {
  vi.clearAllMocks()
  repos.contasQueAssinam.mockResolvedValue([{ ...conta }])
  repos.faturasVencidasDeTodas.mockResolvedValue([])
})

describe('a régua do atraso', () => {
  const momento = () => (repos.enviarModelo.mock.calls.at(-1) as unknown[] | undefined)?.[2] as { momento: string; proxima: string } | undefined

  it('no dia do vencimento, nada', async () => {
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-20')])
    await passadaDaMensalidade(dia('2026-10-20'))
    expect(repos.enviarModelo).not.toHaveBeenCalled()
  })

  it('no dia 1, lembrete gentil, sem travar nada', async () => {
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-20')])
    await passadaDaMensalidade(dia('2026-10-21'))
    expect(momento()?.momento).toBe('lembrete')
    expect(repos.definirSuspensao).not.toHaveBeenCalled()
  })

  it('no dia 7, último aviso com a data da suspensão (dia 10)', async () => {
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-20')])
    await passadaDaMensalidade(dia('2026-10-27'))
    expect(momento()).toMatchObject({ momento: 'final', proxima: '30 de outubro' })
    expect(repos.definirSuspensao).not.toHaveBeenCalled()
  })

  it('no dia 10, suspende o painel e manda o link de pagar', async () => {
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-20')])
    const r = await passadaDaMensalidade(dia('2026-10-30'))
    expect(r).toMatchObject({ suspensas: 1, pausadas: 0 })
    expect(repos.definirSuspensao).toHaveBeenCalledWith('c1', true)
    expect(repos.gravarAssinatura).toHaveBeenCalledWith('c1', { estado: 'suspensa' })
    expect(repos.enviarModelo).toHaveBeenCalledWith(
      expect.anything(),
      'mensalidadeAtrasada',
      expect.objectContaining({ momento: 'suspensa', link: 'https://asaas.test/i/1' }),
    )
  })

  it('passada perdida não pula etapa, e manda um e-mail só', async () => {
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-20')])
    await passadaDaMensalidade(dia('2026-11-02'))
    expect(repos.definirSuspensao).toHaveBeenCalledWith('c1', true)
    expect(repos.enviarModelo).toHaveBeenCalledTimes(1)
  })

  it('no dia 30, pausa os recursos pagos', async () => {
    repos.contasQueAssinam.mockResolvedValue([{ ...conta, estado: 'suspensa', suspensaEm: '2026-10-30T07:00:00Z' }])
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-01')])
    const r = await passadaDaMensalidade(dia('2026-10-31'))
    expect(r).toMatchObject({ suspensas: 0, pausadas: 1 })
    expect(repos.gravarAssinatura).toHaveBeenCalledWith('c1', { estado: 'pausada' })
    expect(momento()?.momento).toBe('pausada')
  })

  it('no dia 60, cancela a assinatura no Asaas', async () => {
    repos.contasQueAssinam.mockResolvedValue([{ ...conta, estado: 'pausada', suspensaEm: '2026-09-10T07:00:00Z' }])
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-09-01')])
    const r = await passadaDaMensalidade(dia('2026-10-31'))
    expect(r).toMatchObject({ canceladas: 1 })
    expect(asaas.cancelarAssinatura).toHaveBeenCalledWith('sub_1')
    expect(repos.gravarAssinatura).toHaveBeenCalledWith('c1', { assinaturaRef: null, estado: 'cancelada_por_atraso' })
  })

  it('conta já suspensa não é suspensa de novo', async () => {
    repos.contasQueAssinam.mockResolvedValue([{ ...conta, suspensaEm: '2026-10-01T00:00:00Z' }])
    repos.faturasVencidasDeTodas.mockResolvedValue([vencida('2026-10-15')])
    await passadaDaMensalidade(dia('2026-10-27'))
    expect(repos.definirSuspensao).not.toHaveBeenCalled()
  })
})

describe('o excedente', () => {
  it('no começo do mês, cobra à parte as conversas acima da faixa do mês que fechou', async () => {
    const r = await passadaDaMensalidade(dia('2026-11-01'))
    expect(r).toMatchObject({ excedentes: 1 })
    expect(asaas.criarCobrancaAvulsa).toHaveBeenCalledWith(
      expect.objectContaining({ clienteAsaas: 'cus_1', valorCentavos: 400, referencia: 'excedente:c1:2026-10', vencimento: '2026-11-06' }),
    )
  })

  it('não cobra duas vezes o mesmo mês', async () => {
    asaas.cobrancaPorReferencia.mockResolvedValueOnce('pay_antigo')
    const r = await passadaDaMensalidade(dia('2026-11-02'))
    expect(r).toMatchObject({ excedentes: 0 })
    expect(asaas.criarCobrancaAvulsa).not.toHaveBeenCalled()
  })

  it('depois do dia 5, não tenta mais', async () => {
    await passadaDaMensalidade(dia('2026-11-06'))
    expect(asaas.cobrancaPorReferencia).not.toHaveBeenCalled()
  })

  it('quem ainda não pagou a primeira fatura não leva excedente', async () => {
    repos.contasQueAssinam.mockResolvedValue([{ ...conta, estado: 'aguardando' }])
    await passadaDaMensalidade(dia('2026-11-01'))
    expect(asaas.criarCobrancaAvulsa).not.toHaveBeenCalled()
  })
})

it('sem a chave da 4YU, não roda', async () => {
  asaas.mensalidadeConfigurada.mockReturnValueOnce(false)
  expect(await passadaDaMensalidade(dia('2026-11-01'))).toBeNull()
  expect(repos.contasQueAssinam).not.toHaveBeenCalled()
})
