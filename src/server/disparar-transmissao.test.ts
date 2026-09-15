import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canal, EnvioDeTemplate } from '@/channels/types'

const lerTransmissao = vi.fn()
const lerTemplate = vi.fn()
const proximosDaFila = vi.fn()
const marcarDestinatario = vi.fn().mockResolvedValue(undefined)
const mudarEstadoDaTransmissao = vi.fn().mockResolvedValue(undefined)
const progressoDa = vi.fn()

vi.mock('./repos/transmissoes', () => ({
  lerTransmissao: (...a: unknown[]) => lerTransmissao(...a),
  proximosDaFila: (...a: unknown[]) => proximosDaFila(...a),
  marcarDestinatario: (...a: unknown[]) => marcarDestinatario(...a),
  mudarEstadoDaTransmissao: (...a: unknown[]) => mudarEstadoDaTransmissao(...a),
  progressoDa: (...a: unknown[]) => progressoDa(...a),
}))
vi.mock('./repos/templates', () => ({ lerTemplate: (...a: unknown[]) => lerTemplate(...a) }))
vi.mock('./repos/conversas', () => ({ listarCanais: vi.fn().mockResolvedValue([]) }))
vi.mock('./adaptador-do-canal', () => ({ adaptadorDoCanal: vi.fn() }))
vi.mock('./alertar', () => ({ alertar: vi.fn().mockResolvedValue(undefined) }))

const { dispararTransmissao, valoresPara } = await import('./disparar-transmissao')

const TRANSMISSAO = {
  id: 't1',
  clienteId: 'c1',
  nome: 'Campanha',
  templateId: 'tpl1',
  parametros: {} as Record<string, string>,
  quando: null,
  estado: 'agendada' as const,
  criadaPor: null,
  criadaPorNome: null,
  criadaEm: '',
  comecouEm: null,
  terminouEm: null,
  erro: null,
}

const TEMPLATE = {
  id: 'tpl1',
  clienteId: 'c1',
  nome: 'lembrete',
  idioma: 'pt_BR',
  categoria: 'UTILITY' as const,
  componentes: { corpo: 'Oi {{1}}, tudo certo?' },
  wabaTemplateId: '999',
  status: 'aprovado' as const,
  qualidade: 'GREEN',
  motivoRecusa: null,
  criadoEm: '',
  atualizadoEm: '',
}

function destinatarios(quantos: number) {
  return Array.from({ length: quantos }, (_, i) => ({
    id: `d${i}`,
    transmissaoId: 't1',
    contatoId: `ct${i}`,
    waId: `55449${i}`,
    nome: `Pessoa ${i}`,
    estado: 'na_fila' as const,
    wamid: null,
    codigoErro: null,
    erro: null,
  }))
}

/** Um canal que responde o que o teste mandar. */
function canalQue(responder: () => Promise<EnvioDeTemplate>): Canal {
  return {
    aguardarResposta: vi.fn(),
    enviarTexto: vi.fn(),
    enviarOpcoes: vi.fn(),
    enviarMidia: vi.fn(),
    enviarTemplate: vi.fn(responder),
  } as unknown as Canal
}

const aceita = () => canalQue(async () => ({ wamid: 'w1', situacao: 'aceita' as const }))
/** Sem espera de verdade: o ritmo é provado pelo `intervaloMs`, não aqui. */
const semEspera = { esperar: async () => {} }

beforeEach(() => {
  vi.clearAllMocks()
  lerTransmissao.mockResolvedValue(TRANSMISSAO)
  lerTemplate.mockResolvedValue(TEMPLATE)
  proximosDaFila.mockResolvedValue(destinatarios(2))
  progressoDa.mockResolvedValue({
    na_fila: 0,
    aceita: 2,
    retida: 0,
    entregue: 0,
    lida: 0,
    falhou: 0,
    total: 2,
  })
})

describe('o disparo', () => {
  it('manda para cada um da fila e conta os aceitos', async () => {
    const canal = aceita()
    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).toHaveBeenCalledTimes(2)
    expect(r.tentados).toBe(2)
    expect(r.aceitos).toBe(2)
  })

  /*
   * A armadilha central: 200 com `held_for_quality_assessment` NÃO é entrega.
   * Gravar "aceita" ali é o que faz a tela dizer "campanha enviada" quando a
   * Meta ainda está decidindo — e pode descartar tudo.
   */
  it('grava retida como retida, e nunca como aceita', async () => {
    const canal = canalQue(async () => ({ wamid: 'w1', situacao: 'retida' as const }))
    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(r.retidos).toBe(2)
    expect(r.aceitos).toBe(0)
    expect(marcarDestinatario).toHaveBeenCalledWith('d0', {
      estado: 'retida',
      wamid: 'w1',
    })
  })

  it('recusa modelo que não está aprovado, antes de mandar nada', async () => {
    // Aprovado ontem pode estar pausado hoje: a Meta pausa sem avisar antes.
    lerTemplate.mockResolvedValue({ ...TEMPLATE, status: 'pausado' })
    const canal = aceita()

    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).not.toHaveBeenCalled()
    expect(r.parou).toMatch(/pausado/)
    expect(mudarEstadoDaTransmissao).toHaveBeenCalledWith('t1', 'falhou', expect.anything())
  })

  it('não mexe em transmissão cancelada', async () => {
    lerTransmissao.mockResolvedValue({ ...TRANSMISSAO, estado: 'cancelada' })
    const canal = aceita()

    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).not.toHaveBeenCalled()
    expect(r.terminou).toBe(true)
  })

  /*
   * 132015 é o template morto. Seguir tentando produz o mesmo erro contra os
   * 5.000 que sobraram, e cada um conta contra a nota de qualidade do número.
   */
  it('para tudo no primeiro 132015, sem tentar os seguintes', async () => {
    proximosDaFila.mockResolvedValue(destinatarios(5))
    const canal = canalQue(async () => {
      throw new Error('Cloud API respondeu 400: {"error":{"code":132015}}')
    })

    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).toHaveBeenCalledTimes(1)
    expect(r.parou).toMatch(/pausado ou reprovado/)
    expect(mudarEstadoDaTransmissao).toHaveBeenCalledWith('t1', 'falhou', expect.anything())
  })

  it('para tudo quando o payload está errado, que é bug nosso', async () => {
    // Se está errado para um, está errado para todos. Retry repete o erro.
    proximosDaFila.mockResolvedValue(destinatarios(5))
    const canal = canalQue(async () => {
      throw new Error('Cloud API respondeu 400: {"error":{"code":132000}}')
    })

    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).toHaveBeenCalledTimes(1)
    expect(r.parou).toMatch(/não bate com o modelo/)
  })

  /*
   * 131026 é terminal para ESTE contato e só. Parar a campanha por causa de um
   * número que não tem WhatsApp seria o erro oposto.
   */
  it('um contato que não recebe não derruba a transmissão', async () => {
    proximosDaFila.mockResolvedValue(destinatarios(3))
    let chamadas = 0
    const canal = canalQue(async () => {
      chamadas += 1
      if (chamadas === 1) throw new Error('respondeu 400: {"error":{"code":131026}}')
      return { wamid: 'w', situacao: 'aceita' as const }
    })

    const r = await dispararTransmissao('t1', { canal, ...semEspera })

    expect(canal.enviarTemplate).toHaveBeenCalledTimes(3)
    expect(r.falhas).toBe(1)
    expect(r.aceitos).toBe(2)
  })

  it('grava o erro em português, e não o texto cru da Meta', async () => {
    proximosDaFila.mockResolvedValue(destinatarios(1))
    const canal = canalQue(async () => {
      throw new Error('respondeu 400: {"error":{"code":131026}}')
    })

    await dispararTransmissao('t1', { canal, ...semEspera })

    expect(marcarDestinatario).toHaveBeenCalledWith('d0', {
      estado: 'falhou',
      codigoErro: 131026,
      erro: 'Este número não recebe: ou não tem WhatsApp, ou bloqueou a empresa.',
    })
  })

  it('conclui quando a fila esvazia', async () => {
    await dispararTransmissao('t1', { canal: aceita(), ...semEspera })

    expect(mudarEstadoDaTransmissao).toHaveBeenCalledWith('t1', 'concluida')
  })

  it('não conclui enquanto sobrar gente na fila', async () => {
    progressoDa.mockResolvedValue({
      na_fila: 300,
      aceita: 200,
      retida: 0,
      entregue: 0,
      lida: 0,
      falhou: 0,
      total: 500,
    })

    await dispararTransmissao('t1', { canal: aceita(), ...semEspera })

    expect(mudarEstadoDaTransmissao).not.toHaveBeenCalledWith('t1', 'concluida')
  })

  it('respeita o ritmo entre um envio e o outro', async () => {
    const esperas: number[] = []
    await dispararTransmissao('t1', {
      canal: aceita(),
      esperar: async (ms) => {
        esperas.push(ms)
      },
    })

    // 20 por segundo = 50ms. Sem isto, a transmissão come a cota do atendimento.
    expect(esperas).toEqual([50, 50])
  })

  it('recusa canal que não sabe mandar modelo', async () => {
    const semTemplate = {
      aguardarResposta: vi.fn(),
      enviarTexto: vi.fn(),
      enviarOpcoes: vi.fn(),
      enviarMidia: vi.fn(),
    } as unknown as Canal

    const r = await dispararTransmissao('t1', { canal: semTemplate, ...semEspera })

    expect(r.parou).toMatch(/não sabe enviar modelo/)
  })
})

describe('os valores das variáveis', () => {
  it('não manda nada quando o modelo não tem variável', () => {
    expect(valoresPara({}, { nome: 'Ana' }, 'Sua consulta foi confirmada.')).toEqual({})
  })

  it('troca {nome} pelo nome do contato', () => {
    // É o que permite uma transmissão dizer "Oi, Ana" e "Oi, João" com o mesmo
    // template, em vez de 400 transmissões, uma por nome.
    const v = valoresPara({ '1': '{nome}' }, { nome: 'Ana' }, 'Oi {{1}}')
    expect(v.corpo).toEqual(['Ana'])
  })

  it('mantém o valor fixo que vale para todo o público', () => {
    const v = valoresPara({ '1': '{nome}', '2': '15/10' }, { nome: 'Ana' }, 'Oi {{1}}, dia {{2}}')
    expect(v.corpo).toEqual(['Ana', '15/10'])
  })

  /*
   * Parâmetro vazio é recusa 132000 da Meta. E "Oi, " sem nome é pior que
   * "Oi, tudo bem?".
   */
  it('nunca manda valor vazio, que a Meta recusa', () => {
    const v = valoresPara({ '1': '{nome}' }, { nome: null }, 'Oi {{1}}')
    expect(v.corpo).toEqual(['tudo bem'])
  })

  it('preenche a variável que ninguém definiu', () => {
    const v = valoresPara({}, { nome: 'Ana' }, 'Oi {{1}}')
    expect(v.corpo).toEqual(['Ana'])
  })
})
