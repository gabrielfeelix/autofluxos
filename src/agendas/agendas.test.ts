import { describe, expect, it } from 'vitest'
import { conectorAgendaPro } from './agendapro'
import { conectorClinicaNasNuvens } from './clinica-nas-nuvens'
import { diasEntre, guardarNoId, lerDoId, mesmoTelefone, telefoneNacional } from './comum'
import { conectorEvo } from './evo'
import { conectorFeegow, horariosDaFeegow, marcacoesDaFeegow } from './feegow'
import { conectorTrinks } from './trinks'
import type { PessoaDaAgenda } from './types'

/**
 * Os conectores de agenda contra respostas no formato das documentações de
 * cada sistema (30/out/2026). Os valores são nossos; os nomes dos campos e o
 * aninhamento são os da documentação.
 */

type Chamada = { url: string; metodo: string; corpo: unknown; cabecalhos: Record<string, string> }

function falso(rotas: [RegExp, unknown, number?][]) {
  const chamadas: Chamada[] = []
  const buscar = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    chamadas.push({
      url: u,
      metodo: init?.method ?? 'GET',
      corpo: init?.body ? JSON.parse(String(init.body)) : null,
      cabecalhos: (init?.headers ?? {}) as Record<string, string>,
    })
    const rota = rotas.find(([padrao]) => padrao.test(u))
    if (!rota) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(rota[1]), { status: rota[2] ?? 200, headers: { 'content-type': 'application/json' } })
  }
  return { buscar, chamadas }
}

const MARIA: PessoaDaAgenda = { telefone: '5544999998888', nome: 'Maria Souza' }

describe('o que todo conector usa', () => {
  it('o id do horário vai e volta sem perder nada', () => {
    const id = guardarNoId({ s: 'feegow', p: '10', d: '2026-11-03', h: '09:30' })
    expect(lerDoId(id)).toEqual({ s: 'feegow', p: '10', d: '2026-11-03', h: '09:30' })
    expect(lerDoId('s7')).toBeNull()
    expect(lerDoId('h!!!')).toBeNull()
  })

  it('período de no máximo 7 dias, e vazio se invertido', () => {
    expect(diasEntre('2026-11-01', '2026-11-30')).toHaveLength(7)
    expect(diasEntre('2026-11-05', '2026-11-01')).toEqual([])
    expect(diasEntre('2026-11-01', '2026-11-01')).toEqual(['2026-11-01'])
  })

  it('telefone sem o 55, e comparação pelos últimos oito dígitos', () => {
    expect(telefoneNacional('5544999998888')).toBe('44999998888')
    expect(mesmoTelefone('(44) 99999-8888', '5544999998888')).toBe(true)
    expect(mesmoTelefone('(44) 99999-1111', '5544999998888')).toBe(false)
    expect(mesmoTelefone('', '5544999998888')).toBe(false)
  })
})

describe('Feegow', () => {
  const especialidades = new Map([['95', 'Dermatologia']])
  const profissionais = new Map([['10', 'Dra. Ana']])

  it('lê a disponibilidade aninhada, com local em lista ou em objeto', () => {
    const lista = horariosDaFeegow(
      { profissional_id: { '10': { local_id: [{ '2026-11-03': ['09:00:00', '09:30:00'] }] } } },
      '95', especialidades, profissionais,
    )
    expect(lista.map((h) => `${h.data} ${h.hora} ${h.profissional} ${h.servico}`)).toEqual([
      '2026-11-03 09:00 Dra. Ana Dermatologia',
      '2026-11-03 09:30 Dra. Ana Dermatologia',
    ])
    expect(lerDoId(lista[0]!.horarioId)).toMatchObject({ s: 'feegow', p: '10', l: '0', e: '95', d: '2026-11-03', h: '09:00' })

    const porObjeto = horariosDaFeegow({ profissional_id: { '10': { local_id: { '3': { '2026-11-04': ['14:00:00'] } } } } }, '95', especialidades, profissionais)
    expect(lerDoId(porObjeto[0]!.horarioId)).toMatchObject({ l: '3', d: '2026-11-04', h: '14:00' })
  })

  it('só marcação em aberto (1 marcado, 7 confirmado) aparece como da pessoa', () => {
    const m = marcacoesDaFeegow(
      [
        { agendamento_id: 41, data: '06-11-2026', horario: '08:30:00', status_id: 7, especialidade_id: 95, profissional_id: 10 },
        { agendamento_id: 42, data: '07-11-2026', horario: '10:00:00', status_id: 11 },
      ],
      especialidades, profissionais,
    )
    expect(m).toEqual([{ marcacaoId: '41', data: '2026-11-06', hora: '08:30', servico: 'Dermatologia', profissional: 'Dra. Ana', situacao: 'Confirmado' }])
  })

  it('sem especialidade, avisa em vez de responder "não há horário"', async () => {
    const { buscar } = falso([])
    const r = await conectorFeegow('t', {}, buscar).horarios({ de: '2026-11-03', ate: '2026-11-03' })
    expect(r).toEqual({ ok: true, valor: { horarios: [], aviso: expect.stringContaining('especialidade') } })
  })

  it('marca achando o paciente pelo telefone, com o token no cabeçalho e a data em DD-MM-YYYY', async () => {
    const { buscar, chamadas } = falso([
      [/patient\/list/, { success: true, content: [{ patient_id: 77 }] }],
      [/new-appoint/, { success: true, content: { agendamento_id: 43 } }],
    ])
    const id = guardarNoId({ s: 'feegow', p: '10', l: '0', e: '95', d: '2026-11-03', h: '09:00' })
    const r = await conectorFeegow('tok', {}, buscar).marcar(id, MARIA)
    expect(r).toMatchObject({ ok: true, valor: { marcacaoId: '43', data: '2026-11-03', hora: '09:00' } })
    expect(chamadas[0]!.url).toContain('telefone=44999998888')
    expect(chamadas[1]!.cabecalhos['x-access-token']).toBe('tok')
    expect(chamadas[1]!.corpo).toMatchObject({ paciente_id: 77, profissional_id: 10, especialidade_id: 95, data: '03-11-2026', horario: '09:00:00' })
  })

  it('id de horário de outro sistema não marca', async () => {
    const { buscar, chamadas } = falso([])
    const r = await conectorFeegow('t', {}, buscar).marcar(guardarNoId({ s: 'trinks', d: '2026-11-03', h: '09:00' }), MARIA)
    expect(r.ok).toBe(false)
    expect(chamadas).toHaveLength(0)
  })

  it('token recusado vira frase, não exceção', async () => {
    const { buscar } = falso([[/specialties/, {}, 401]])
    expect(await conectorFeegow('t', {}, buscar).conferir()).toEqual({ ok: false, motivo: 'a Feegow recusou a chave' })
  })
})

describe('Clínica nas Nuvens', () => {
  const segredo = { clientId: 'id', clientSecret: 'seg', cid: 'cid-da-clinica' }

  it('sem CPF, pede o CPF em vez de falhar', async () => {
    const { buscar } = falso([])
    const r = await conectorClinicaNasNuvens(segredo, {}, buscar).minhas(MARIA)
    expect(r).toEqual({ ok: false, motivo: 'falta o CPF', pedir: 'cpf' })
  })

  it('CPF de um cadastro com outro celular não abre a agenda de ninguém', async () => {
    const { buscar, chamadas } = falso([
      [/paciente\/lista/, { lista: [{ id: 5, contato: { telefoneCelular: '(11) 98888-0000' } }] }],
    ])
    const r = await conectorClinicaNasNuvens(segredo, {}, buscar).minhas({ ...MARIA, cpf: '123.456.789-09' })
    expect(r).toEqual({ ok: false, motivo: 'o CPF informado é de um cadastro com outro telefone' })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.cabecalhos['clinicaNasNuvens-cid']).toBe('cid-da-clinica')
    expect(chamadas[0]!.cabecalhos.authorization).toBe(`Basic ${Buffer.from('id:seg').toString('base64')}`)
  })

  it('lista só as marcações em aberto do paciente conferido', async () => {
    const { buscar } = falso([
      [/paciente\/lista/, { lista: [{ id: 5, contato: { telefoneCelular: '44999998888' } }] }],
      [/agenda\/lista/, { lista: [
        { id: 900, data: '2026-11-06', horaInicio: '08:00', status: 'AGENDADO' },
        { id: 901, data: '2026-11-07', horaInicio: '09:00', status: 'CANCELADO' },
      ] }],
    ])
    const r = await conectorClinicaNasNuvens(segredo, {}, buscar).minhas({ ...MARIA, cpf: '12345678909' })
    expect(r).toEqual({ ok: true, valor: [{ marcacaoId: '900', data: '2026-11-06', hora: '08:00', situacao: 'Marcado' }] })
  })

  it('marca com o convênio que o paciente já tem e a agenda da conexão', async () => {
    const { buscar, chamadas } = falso([
      [/convenio-paciente\/lista/, { lista: [{ id: 31, idTipoConvenio: 2 }] }],
      [/paciente\/lista/, { lista: [{ id: 5, contato: { telefoneCelular: '44999998888' } }] }],
      [/agenda\/novo/, { id: 950 }],
    ])
    const id = guardarNoId({ s: 'cnn', x: '7', pp: '70', d: '2026-11-06', h: '08:00', f: '08:30', t: '4', pn: 'Dr. João' })
    const r = await conectorClinicaNasNuvens(segredo, { idLocalAgenda: 1, idTipoConsulta: 4 }, buscar).marcar(id, { ...MARIA, cpf: '12345678909' })
    expect(r).toMatchObject({ ok: true, valor: { marcacaoId: '950', profissional: 'Dr. João' } })
    expect(chamadas.at(-1)!.corpo).toMatchObject({
      data: '2026-11-06', horaInicio: '08:00', horaFim: '08:30', idLocalAgenda: 1, idPaciente: 5,
      idPacienteConvenio: 31, idTipoConsulta: 4, idPessoaExecutor: 70, status: 'AGENDADO',
    })
  })
})

describe('Trinks', () => {
  it('confere a vaga antes de gravar, porque a Trinks não confere conflito', async () => {
    const { buscar, chamadas } = falso([[/agendamentos\/profissionais/, { data: [{ id: 3, nome: 'Bruno', horariosVagos: ['10:00'] }] }]])
    const id = guardarNoId({ s: 'trinks', p: '3', d: '2026-11-03', h: '09:00', sv: '8', du: '30' })
    const r = await conectorTrinks('k', { estabelecimentoId: '99' }, buscar).marcar(id, MARIA)
    expect(r).toEqual({ ok: false, motivo: 'esse horário acabou de ser ocupado' })
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false)
  })

  it('marca na vaga livre, com a chave e o estabelecimento nos cabeçalhos', async () => {
    const { buscar, chamadas } = falso([
      [/agendamentos\/profissionais/, { data: [{ id: 3, nome: 'Bruno', horariosVagos: ['09:00'] }] }],
      [/v1\/clientes/, { data: [{ id: 12 }] }],
      [/v1\/agendamentos$/, { id: 500 }],
    ])
    const id = guardarNoId({ s: 'trinks', p: '3', d: '2026-11-03', h: '09:00', sv: '8', du: '45', en: 'Corte', pn: 'Bruno' })
    const r = await conectorTrinks('k', { estabelecimentoId: '99' }, buscar).marcar(id, MARIA)
    expect(r).toMatchObject({ ok: true, valor: { marcacaoId: '500', servico: 'Corte', profissional: 'Bruno' } })
    const post = chamadas.find((c) => c.metodo === 'POST')!
    expect(post.cabecalhos).toMatchObject({ 'X-Api-Key': 'k', estabelecimentoId: '99' })
    expect(post.corpo).toMatchObject({ servicoId: 8, clienteId: 12, profissionalId: 3, dataHoraInicio: '2026-11-03T09:00:00', duracaoEmMinutos: 45 })
  })

  it('desmarca como cancelado pela cliente', async () => {
    const { buscar, chamadas } = falso([[/status\/cancelado/, {}]])
    expect(await conectorTrinks('k', { estabelecimentoId: '99' }, buscar).desmarcar('500', MARIA)).toEqual({ ok: true, valor: true })
    expect(chamadas[0]).toMatchObject({ metodo: 'PATCH', corpo: { quemCancelou: 1 } })
  })
})

describe('AgendaPro', () => {
  it('lê as vagas do dia no envelope data.slots', async () => {
    const { buscar } = falso([
      [/available_slots/, { data: { slots: [{ start_time: '09:00', end_time: '09:30', provider_id: 12, provider_name: 'Carla' }], metadata: {} } }],
    ])
    const r = await conectorAgendaPro('apk_live_x', { locationId: 1 }, buscar).horarios({ de: '2026-11-03', ate: '2026-11-03', servicoId: '10' })
    expect(r.ok && r.valor.horarios.map((h) => `${h.data} ${h.hora} ${h.profissional}`)).toEqual(['2026-11-03 09:00 Carla'])
  })

  it('só aceita o cliente cujo telefone confere, e grava a hora local com Z', async () => {
    const { buscar, chamadas } = falso([
      [/quick-search/, { data: [{ id: 1, phone: '+5511900000000' }, { id: 2, phone: '+5544999998888' }] }],
      [/v3\/bookings$/, { id: 77 }],
    ])
    const id = guardarNoId({ s: 'agendapro', d: '2026-11-03', h: '09:00', f: '09:30', sv: '10', p: '12', l: '1' })
    const r = await conectorAgendaPro('apk_live_x', {}, buscar).marcar(id, MARIA)
    expect(r).toMatchObject({ ok: true, valor: { marcacaoId: '77' } })
    expect(chamadas.at(-1)!.corpo).toMatchObject({ client_id: 2, start_time: '2026-11-03T09:00:00Z', end_time: '2026-11-03T09:30:00Z' })
  })
})

describe('EVO', () => {
  it('pula aula lotada e guarda a sessão no id', async () => {
    const { buscar } = falso([
      [/activities\/schedule/, [
        { idConfiguration: 5, name: 'Pilates', startTime: '07:00', activityDate: '2026-11-03T00:00:00', capacity: 5, ocupation: 5 },
        { idConfiguration: 6, name: 'Pilates', startTime: '08:00', activityDate: '2026-11-03T00:00:00', capacity: 5, ocupation: 2, instructor: 'Lia' },
      ]],
    ])
    const r = await conectorEvo({ dns: 'academia', chave: 's' }, {}, buscar).horarios({ de: '2026-11-03', ate: '2026-11-03' })
    expect(r.ok && r.valor.horarios.map((h) => h.hora)).toEqual(['08:00'])
    expect(r.ok && lerDoId(r.valor.horarios[0]!.horarioId)).toMatchObject({ s: 'evo', c: '6', d: '2026-11-03' })
  })

  it('quem não é aluno não reserva, e desmarcar vai para a recepção', async () => {
    const { buscar } = falso([[/v2\/members/, []]])
    const evo = conectorEvo({ dns: 'academia', chave: 's' }, {}, buscar)
    const id = guardarNoId({ s: 'evo', c: '6', d: '2026-11-03', h: '08:00' })
    expect(await evo.marcar(id, MARIA)).toEqual({ ok: false, motivo: 'não há aluno com este telefone na EVO' })
    expect((await evo.desmarcar('x', MARIA)).ok).toBe(false)
  })
})
