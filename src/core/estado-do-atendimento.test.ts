import { describe, expect, it } from 'vitest'
import { estadoDoAtendimento, type EntradaDoAtendimento } from './estado-do-atendimento'

const base: EntradaDoAtendimento = {
  automacaoAtiva: true,
  aguardando: null,
  atribuidoA: null,
  sessaoComPessoa: false,
  estado: 'aberta',
  temAutomacao: true,
  usuarioId: 'eu',
}

describe('estadoDoAtendimento', () => {
  it('bot: responsável sozinho não cala o bot', () => {
    const r = estadoDoAtendimento({ ...base, atribuidoA: 'ana' })
    expect(r).toMatchObject({ estado: 'bot', donoId: 'ana', botCalado: false, proximaAcao: 'assumir' })
  })

  it('aguardando humano: pedido em aberto vence tudo', () => {
    const r = estadoDoAtendimento({
      ...base,
      aguardando: { motivo: 'pediu atendente', desde: '2026-09-23T10:00:00Z' },
      automacaoAtiva: false,
      sessaoComPessoa: true,
    })
    expect(r).toMatchObject({ estado: 'aguardando_humano', botCalado: true, proximaAcao: 'assumir' })
    expect(estadoDoAtendimento({ ...base, aguardando: { motivo: 'x', desde: 'y' }, atribuidoA: 'eu' }).proximaAcao).toBe('finalizar')
  })

  it('com humano: sessão com pessoa cala o bot e o dono finaliza', () => {
    const r = estadoDoAtendimento({ ...base, sessaoComPessoa: true, atribuidoA: 'eu' })
    expect(r).toMatchObject({ estado: 'com_humano', rotulo: 'Em atendimento', botCalado: true, proximaAcao: 'finalizar' })
    expect(r.efeito).toContain('volta a responder na próxima mensagem')
    // Com outra pessoa atendendo, a ação oferecida é assumir.
    expect(estadoDoAtendimento({ ...base, sessaoComPessoa: true, atribuidoA: 'ana' }).proximaAcao).toBe('assumir')
  })

  it('com humano: pausa só volta religando', () => {
    const r = estadoDoAtendimento({ ...base, automacaoAtiva: false })
    expect(r).toMatchObject({ estado: 'com_humano', rotulo: 'Bot pausado', proximaAcao: 'religar_bot' })
  })

  it('encerrado: conversa resolvida diz que o bot volta', () => {
    const r = estadoDoAtendimento({ ...base, estado: 'resolvida' })
    expect(r).toMatchObject({ estado: 'encerrado', botCalado: false, proximaAcao: null })
    expect(r.efeito).toBe('Na próxima mensagem o bot volta a responder.')
  })

  it('conta sem automação nunca diz que o bot responde', () => {
    const r = estadoDoAtendimento({ ...base, temAutomacao: false })
    expect(r).toMatchObject({ estado: 'com_humano', rotulo: 'Atendimento manual', botCalado: true })
  })
})
