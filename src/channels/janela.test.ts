import { describe, expect, it } from 'vitest'
import { comoFalta, dentroDaJanela, JANELA_MS, podeReagir, restaDaJanela } from './janela'

/**
 * A regra das 24h do WhatsApp, conferida sem rede.
 *
 * O que está sendo protegido aqui não é a aritmética — é a postura: qualquer
 * dúvida sobre a janela fecha a caixa de resposta. Uma janela aberta por
 * engano vira uma mensagem escrita, enviada e recusada pela Meta com um código
 * entre parênteses.
 */

const AGORA = Date.parse('2026-08-12T12:00:00.000Z')
const atras = (ms: number) => new Date(AGORA - ms).toISOString()

describe('a janela de 24h', () => {
  it('está aberta logo depois da pessoa escrever', () => {
    expect(dentroDaJanela(atras(60_000), AGORA)).toBe(true)
    expect(restaDaJanela(atras(60_000), AGORA)).toBe(JANELA_MS - 60_000)
  })

  it('está fechada 24h depois, e não um pouco depois disso', () => {
    expect(dentroDaJanela(atras(JANELA_MS - 1), AGORA)).toBe(true)
    expect(dentroDaJanela(atras(JANELA_MS), AGORA)).toBe(false)
    expect(dentroDaJanela(atras(JANELA_MS + 1), AGORA)).toBe(false)
  })

  it('nunca fica negativa — passou é passou', () => {
    expect(restaDaJanela(atras(JANELA_MS * 3), AGORA)).toBe(0)
  })

  /** Quem nunca escreveu não tem janela aberta, e nem uma que já fechou. */
  it('não abre para quem nunca escreveu', () => {
    expect(dentroDaJanela(null, AGORA)).toBe(false)
    expect(restaDaJanela(null, AGORA)).toBeNull()
  })

  /**
   * Falha fechado. Data ilegível é defeito nosso, e o erro barulhento é a tela
   * dizer que não dá — não a Meta recusar depois de alguém digitar.
   */
  it('data ilegível não vira janela aberta', () => {
    expect(dentroDaJanela('ontem à noite', AGORA)).toBe(false)
    expect(restaDaJanela('', AGORA)).toBeNull()
  })

  it('escreve o que falta do jeito que alguém lê', () => {
    expect(comoFalta(3 * 60 * 60 * 1000)).toBe('3h')
    expect(comoFalta(3 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe('3h05')
    expect(comoFalta(12 * 60 * 1000)).toBe('12min')
    // Menos de um minuto ainda é tempo. "0min" pareceria fechada.
    expect(comoFalta(20_000)).toBe('1min')
  })
})

describe('o prazo de reagir, que é outro', () => {
  const agora = Date.parse('2026-09-15T12:00:00Z')

  it('mensagem de ontem pode receber reação', () => {
    expect(podeReagir('2026-09-14T12:00:00Z', agora)).toBe(true)
  })

  it('mensagem de 29 dias ainda pode', () => {
    expect(podeReagir('2026-08-17T12:00:00Z', agora)).toBe(true)
  })

  it('passou de 30 dias, não pode mais', () => {
    expect(podeReagir('2026-08-15T11:00:00Z', agora)).toBe(false)
  })

  /*
   * Os dois prazos da Meta são eixos diferentes, e é por isso que `podeReagir`
   * não reusa `JANELA_MS`. Uma mensagem de cinco dias está muito fora da
   * janela de 24h e continua podendo receber reação — se alguém amarrar os
   * dois, reagir para de funcionar em quase toda conversa real.
   */
  it('reagir não depende da janela de 24h', () => {
    const cincoDias = '2026-09-10T12:00:00Z'
    expect(dentroDaJanela(cincoDias, agora)).toBe(false)
    expect(podeReagir(cincoDias, agora)).toBe(true)
  })

  /* Falha fechado, como `restaDaJanela`: a tela não oferece o que a Meta recusaria. */
  it('data ilegível não pode reagir', () => {
    expect(podeReagir('nao-e-data', agora)).toBe(false)
  })
})
