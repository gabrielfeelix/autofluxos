import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { validar } from '../flow/validar'
import { executar, MENSAGEM_ESPERANDO_FORMULARIO } from './executar'
import { sessaoNova, type Acao, type Sessao } from './types'

const p = { x: 0, y: 0 }

function fluxoDeAgendar(ligado = true): Fluxo {
  return fluxoSchema.parse({
    inicio: 'agendar',
    nodes: [
      { id: 'agendar', type: 'agendar', position: p, data: { texto: 'Oi, {{nome}}! Escolha o horário.', botao: 'Ver horários', horasParaDesistir: 12 } },
      { id: 'ok', type: 'mensagem', position: p, data: { texto: 'Te espero {{horario_marcado}}' } },
      { id: 'fila', type: 'handoff', position: p, data: { motivo: 'não marcou' } },
    ],
    edges: ligado
      ? [
          { id: 'e1', source: 'agendar', sourceHandle: 'marcou', target: 'ok' },
          { id: 'e2', source: 'agendar', sourceHandle: 'nao_marcou', target: 'fila' },
        ]
      : [],
  })
}

const MARCACAO = { participacao_id: 'p1', sessao_id: 's1', resumo: 'Sexta, 23/10 às 07:00.' }
const textos = (acoes: Acao[]) => acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)

function parado(fluxo: Fluxo): Sessao {
  return executar(fluxo, { ...sessaoNova(), vars: { nome: 'Ana' } }, { tipo: 'inicio' }).sessao
}

describe('o bloco Agendar', () => {
  it('manda o formulário e para esperando', () => {
    const r = executar(fluxoDeAgendar(), { ...sessaoNova(), vars: { nome: 'Ana' } }, { tipo: 'inicio' })
    expect(r.acoes).toEqual([
      { tipo: 'enviar_formulario', noId: 'agendar', texto: 'Oi, Ana! Escolha o horário.', botao: 'Ver horários', horasParaDesistir: 12 },
    ])
    expect(r.sessao).toMatchObject({ noAtual: 'agendar', status: 'ativa' })
  })

  it('marcou grava as variáveis e segue pela saída marcou', () => {
    const fluxo = fluxoDeAgendar()
    const r = executar(fluxo, parado(fluxo), { tipo: 'formulario', desfecho: 'marcou', marcacao: MARCACAO })
    expect(textos(r.acoes)).toEqual(['Te espero Sexta, 23/10 às 07:00.'])
    expect(r.sessao.vars).toMatchObject({ participacao_id: 'p1', sessao_id: 's1', horario_marcado: MARCACAO.resumo })
  })

  it('não marcou segue pela saída não marcou', () => {
    const fluxo = fluxoDeAgendar()
    const r = executar(fluxo, parado(fluxo), { tipo: 'formulario', desfecho: 'nao_marcou' })
    expect(r.acoes.at(-1)).toMatchObject({ tipo: 'transferir_humano', motivo: 'não marcou' })
  })

  it('sem saídas desenhadas: marcou confirma e encerra, não marcou vai para a fila calado', () => {
    const fluxo = fluxoDeAgendar(false)
    const marcou = executar(fluxo, parado(fluxo), { tipo: 'formulario', desfecho: 'marcou', marcacao: MARCACAO })
    expect(textos(marcou.acoes)).toEqual(['Pronto, está marcado: Sexta, 23/10 às 07:00.'])
    expect(marcou.sessao.status).toBe('encerrada')

    const nao = executar(fluxo, parado(fluxo), { tipo: 'formulario', desfecho: 'nao_marcou' })
    expect(nao.acoes).toEqual([{ tipo: 'transferir_humano', motivo: 'a pessoa não marcou pelo formulário de agendamento' }])
  })

  it('quem escreve esperando ouve uma vez, e na terceira vai para uma pessoa', () => {
    const fluxo = fluxoDeAgendar()
    const um = executar(fluxo, parado(fluxo), { tipo: 'texto', texto: 'oi' })
    expect(textos(um.acoes)).toEqual([MENSAGEM_ESPERANDO_FORMULARIO])
    const dois = executar(fluxo, um.sessao, { tipo: 'texto', texto: 'ok' })
    expect(dois.acoes).toEqual([])
    const tres = executar(fluxo, dois.sessao, { tipo: 'texto', texto: 'e aí?' })
    expect(tres.sessao.status).toBe('humano')
  })

  it('validar: só WhatsApp, exige formulário publicado e avisa sem a saída não marcou', () => {
    const semFormulario = validar(fluxoDeAgendar(), { formularioDeAgendamento: false })
    expect(semFormulario.erros.map((e) => e.codigo)).toContain('AGENDAR_SEM_FORMULARIO')

    const instagram = validar(fluxoDeAgendar(), { canal: 'instagram', formularioDeAgendamento: true })
    expect(instagram.erros.map((e) => e.codigo)).toContain('AGENDAR_FORA_DO_WHATSAPP')

    const pronto = validar(fluxoDeAgendar(), { formularioDeAgendamento: true })
    expect(pronto.erros.filter((e) => e.codigo.startsWith('AGENDAR'))).toEqual([])
    // {{horario_marcado}} é variável que o bloco grava: não é "desconhecida".
    expect(pronto.erros.map((e) => e.codigo)).not.toContain('VARIAVEL_DESCONHECIDA')

    const semSaida = validar(fluxoDeAgendar(false), { formularioDeAgendamento: true })
    expect(semSaida.avisos.map((a) => a.codigo)).toContain('AGENDAR_SEM_NAO_MARCOU')
  })
})
