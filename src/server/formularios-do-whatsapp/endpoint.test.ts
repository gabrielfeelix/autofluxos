import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acharLead } from '../repos/leads'
import type { FormularioDoWhatsapp } from '../repos/formularios-do-whatsapp'
import { chaveDaAgenda, horariosLivres, marcarNaAgenda, pessoaNaAgenda } from './agenda'
import { responderAoFormulario } from './endpoint'
import { criarTokenDoFormulario, lerTokenDoFormulario } from './token'

/**
 * O endpoint do formulário sem rede: o token, as três telas e o que acontece
 * quando a agenda recusa ou cai.
 */

vi.mock('server-only', () => ({}))
vi.mock('../repos/leads', () => ({ acharLead: vi.fn() }))
vi.mock('./agenda', () => ({
  chaveDaAgenda: vi.fn(),
  horariosLivres: vi.fn(),
  pessoaNaAgenda: vi.fn(),
  marcarNaAgenda: vi.fn(),
}))

process.env.BETTER_AUTH_SECRET = 'segredo-de-teste'

const AGORA = new Date('2026-10-22T15:00:00Z')
const FORMULARIO: FormularioDoWhatsapp = {
  id: 'f1',
  clienteId: 'c1',
  canalId: 'k1',
  modelo: 'agendamento',
  flowId: '123',
  status: 'publicado',
  erro: null,
  chavePrivadaRef: 'ref',
  atualizadoEm: '',
}
const TOKEN = criarTokenDoFormulario({ formularioId: 'f1', contatoId: 'ct1', sessaoId: 's1', noId: 'n1' }, AGORA)
const LIVRE = { sessaoId: 'sess1', data: '2026-10-23', hora: '07:00', servico: 'Pilates', profissional: 'Carol', livres: 2 }

const pedir = (corpo: Record<string, unknown>, aoMarcar = vi.fn()) =>
  responderAoFormulario(FORMULARIO, { version: '3.0', flow_token: TOKEN, ...corpo }, aoMarcar, AGORA)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(chaveDaAgenda).mockResolvedValue('vr_x')
  vi.mocked(horariosLivres).mockResolvedValue([LIVRE])
  vi.mocked(acharLead).mockResolvedValue({ waId: '5544999990000', nome: 'Ana' } as never)
  vi.mocked(pessoaNaAgenda).mockResolvedValue('pes1')
  vi.mocked(marcarNaAgenda).mockResolvedValue({ ok: true, participacaoId: 'part1' })
})

describe('token do formulário', () => {
  it('ida e volta, vence no prazo, e adulterado não passa', () => {
    expect(lerTokenDoFormulario(TOKEN, AGORA)).toMatchObject({ ok: true, dados: { formularioId: 'f1', sessaoId: 's1', noId: 'n1' } })
    expect(lerTokenDoFormulario(TOKEN, new Date(AGORA.getTime() + 73 * 3_600_000))).toEqual({ ok: false, motivo: 'vencido' })
    expect(lerTokenDoFormulario(`${TOKEN}x`, AGORA)).toEqual({ ok: false, motivo: 'invalido' })
  })
})

describe('endpoint do formulário', () => {
  it('ping responde ativo, sem token', async () => {
    expect(await responderAoFormulario(FORMULARIO, { action: 'ping' }, vi.fn(), AGORA)).toEqual({
      status: 200,
      corpo: { data: { status: 'active' } },
    })
  })

  it('token de outro formulário é 427', async () => {
    const outro = criarTokenDoFormulario({ formularioId: 'f2', contatoId: 'ct1', sessaoId: null, noId: null }, AGORA)
    expect(await responderAoFormulario(FORMULARIO, { action: 'INIT', flow_token: outro }, vi.fn(), AGORA)).toEqual({ status: 427 })
  })

  it('INIT abre os dias da janela de 14 dias', async () => {
    const r = await pedir({ action: 'INIT' })
    expect(horariosLivres).toHaveBeenCalledWith('vr_x', '2026-10-22', '2026-11-04')
    expect(r).toEqual({ status: 200, corpo: { screen: 'DIA', data: { dias: [{ id: '2026-10-23', title: 'Sexta, 23/10', description: '1 horário livre' }] } } })
  })

  it('escolher o dia mostra os horários', async () => {
    const r = await pedir({ action: 'data_exchange', screen: 'DIA', data: { dia: '2026-10-23' } })
    expect(r).toMatchObject({ corpo: { screen: 'HORARIO', data: { dia: '2026-10-23', dia_rotulo: 'Sexta, 23/10', horarios: [{ id: 'sess1' }] } } })
  })

  it('marcar grava na agenda, confirma e avisa a conversa', async () => {
    const aoMarcar = vi.fn()
    const r = await pedir({ action: 'data_exchange', screen: 'HORARIO', data: { dia: '2026-10-23', sessao: 'sess1' } }, aoMarcar)
    expect(pessoaNaAgenda).toHaveBeenCalledWith('vr_x', '5544999990000', 'Ana')
    expect(marcarNaAgenda).toHaveBeenCalledWith('vr_x', 'pes1', 'sess1')
    const marcacao = { participacao_id: 'part1', sessao_id: 'sess1', resumo: 'Sexta, 23/10 às 07:00, Pilates com Carol.' }
    expect(r).toEqual({ status: 200, corpo: { screen: 'CONFIRMADO', data: marcacao } })
    expect(aoMarcar).toHaveBeenCalledWith(expect.objectContaining({ sessaoId: 's1', noId: 'n1' }), marcacao)
  })

  it('vaga que acabou volta aos horários com a frase da agenda, e não avisa a conversa', async () => {
    vi.mocked(marcarNaAgenda).mockResolvedValue({ ok: false, motivo: 'Este horário está cheio.' })
    const aoMarcar = vi.fn()
    const r = await pedir({ action: 'data_exchange', screen: 'HORARIO', data: { dia: '2026-10-23', sessao: 'sess1' } }, aoMarcar)
    expect(r).toMatchObject({ corpo: { screen: 'HORARIO', data: { error_message: 'Este horário está cheio.' } } })
    expect(aoMarcar).not.toHaveBeenCalled()
  })

  it('agenda fora do ar vira frase na tela, nunca erro HTTP', async () => {
    vi.mocked(horariosLivres).mockRejectedValue(new Error('503'))
    const r = await pedir({ action: 'INIT' })
    expect(r).toMatchObject({ status: 200, corpo: { screen: 'DIA', data: { dias: [], error_message: expect.stringContaining('agenda') } } })
  })

  it('sem Verandi ligada, a primeira tela explica', async () => {
    vi.mocked(chaveDaAgenda).mockResolvedValue(null)
    expect(await pedir({ action: 'INIT' })).toMatchObject({ corpo: { screen: 'DIA', data: { dias: [] } } })
  })
})
