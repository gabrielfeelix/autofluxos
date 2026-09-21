import { describe, expect, it } from 'vitest'
import {
  AVISO_DE_VENCIMENTO_DIAS,
  pedeAcao,
  saudeDoInstagram,
  saudeDoWhatsApp,
  saudePorValidade,
} from './saude-da-conexao'

const AGORA = new Date('2026-09-15T12:00:00Z')

const emDias = (dias: number) =>
  new Date(AGORA.getTime() + dias * 24 * 60 * 60 * 1_000).toISOString()

describe('saudePorValidade', () => {
  it('token com folga está ligado', () => {
    expect(saudePorValidade(emDias(30), AGORA)).toBe('ligada')
  })

  it('token dentro da janela de aviso está vencendo', () => {
    expect(saudePorValidade(emDias(AVISO_DE_VENCIMENTO_DIAS - 1), AGORA)).toBe('vencendo')
  })

  it('token vencido pede reconexão', () => {
    expect(saudePorValidade(emDias(-1), AGORA)).toBe('reconectar')
  })

  /**
   * O caso que decide o desenho: **sem data, não se acusa defeito.** Canal de
   * antes da 0040 não tem validade guardada, e mandar reconectar por falta de
   * dado derrubaria o atendimento de quem estava bem.
   */
  it('sem data de validade, continua ligada', () => {
    expect(saudePorValidade(null, AGORA)).toBe('ligada')
    expect(saudePorValidade(undefined, AGORA)).toBe('ligada')
  })

  it('data ilegível não vira alarme', () => {
    expect(saudePorValidade('isto não é uma data', AGORA)).toBe('ligada')
  })
})

describe('saudeDoWhatsApp', () => {
  it('sem número nenhum, não está ligado, e isso não é defeito', () => {
    expect(saudeDoWhatsApp([])).toBe('nao-ligada')
  })

  it('números de pé estão ligados', () => {
    expect(saudeDoWhatsApp([{ desembarcadoEm: null }, { desembarcadoEm: null }])).toBe('ligada')
  })

  /**
   * Um número fora do ar derruba o selo mesmo com outro funcionando: quem
   * falava com aquele número não está falando com nenhum outro.
   */
  it('um número desembarcado basta para pedir ação', () => {
    expect(
      saudeDoWhatsApp([{ desembarcadoEm: null }, { desembarcadoEm: AGORA.toISOString() }]),
    ).toBe('reconectar')
  })
})

describe('saudeDoInstagram', () => {
  it('sem conta ligada', () => {
    expect(saudeDoInstagram(null, AGORA)).toBe('nao-ligada')
  })

  it('conta com token válido', () => {
    expect(saudeDoInstagram({ tokenExpiraEm: emDias(40) }, AGORA)).toBe('ligada')
  })

  it('conta com token vencido', () => {
    expect(saudeDoInstagram({ tokenExpiraEm: emDias(-2) }, AGORA)).toBe('reconectar')
  })
})

describe('pedeAcao', () => {
  /** "Vencendo" não é urgência: é recado. Só o que já caiu vira faixa no Inbox. */
  it('só reconectar pede ação', () => {
    expect(pedeAcao('reconectar')).toBe(true)
    expect(pedeAcao('vencendo')).toBe(false)
    expect(pedeAcao('ligada')).toBe(false)
    expect(pedeAcao('nao-ligada')).toBe(false)
  })
})
