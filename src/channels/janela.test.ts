import { describe, expect, it } from 'vitest'
import {
  comoFalta,
  dentroDaJanela,
  dentroDaPortaDeEntrada,
  JANELA_DA_PORTA_MS,
  JANELA_MS,
  podeReagir,
  restaDaJanela,
} from './janela'

/**
 * Os prazos do WhatsApp, conferidos sem rede.
 *
 * O que está sendo protegido aqui não é a aritmética, é a postura: qualquer
 * dúvida sobre a janela fecha a caixa de resposta. Uma janela aberta por engano
 * vira uma mensagem escrita, enviada e recusada pela Meta com um código entre
 * parênteses. E uma janela dita gratuita por engano vira fatura.
 */

const AGORA = Date.parse('2026-08-12T12:00:00.000Z')
const atras = (ms: number) => new Date(AGORA - ms).toISOString()
const escreveu = (ms: number) => ({ ultimaEntradaEm: atras(ms) })

describe('a janela de 24h', () => {
  it('está aberta logo depois da pessoa escrever', () => {
    expect(dentroDaJanela(escreveu(60_000), AGORA)).toBe(true)
    expect(restaDaJanela(escreveu(60_000), AGORA)).toBe(JANELA_MS - 60_000)
  })

  it('está fechada 24h depois, e não um pouco depois disso', () => {
    expect(dentroDaJanela(escreveu(JANELA_MS - 1), AGORA)).toBe(true)
    expect(dentroDaJanela(escreveu(JANELA_MS), AGORA)).toBe(false)
    expect(dentroDaJanela(escreveu(JANELA_MS + 1), AGORA)).toBe(false)
  })

  it('nunca fica negativa, passou é passou', () => {
    expect(restaDaJanela(escreveu(JANELA_MS * 3), AGORA)).toBe(0)
  })

  /** Quem nunca escreveu não tem janela aberta, e nem uma que já fechou. */
  it('não abre para quem nunca escreveu', () => {
    expect(dentroDaJanela({ ultimaEntradaEm: null }, AGORA)).toBe(false)
    expect(restaDaJanela({ ultimaEntradaEm: null }, AGORA)).toBeNull()
  })

  /**
   * Falha fechado. Data ilegível é defeito nosso, e o erro barulhento é a tela
   * dizer que não dá, não a Meta recusar depois de alguém digitar.
   */
  it('data ilegível não vira janela aberta', () => {
    expect(dentroDaJanela({ ultimaEntradaEm: 'ontem à noite' }, AGORA)).toBe(false)
    expect(restaDaJanela({ ultimaEntradaEm: '' }, AGORA)).toBeNull()
  })

  it('escreve o que falta do jeito que alguém lê', () => {
    expect(comoFalta(3 * 60 * 60 * 1000)).toBe('3h')
    expect(comoFalta(3 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe('3h05')
    expect(comoFalta(12 * 60 * 1000)).toBe('12min')
    // Menos de um minuto ainda é tempo. "0min" pareceria fechada.
    expect(comoFalta(20_000)).toBe('1min')
  })
})

/**
 * As 72h de quem chegou por anúncio.
 *
 * O caso que estes testes existem para impedir é o mais caro dos dois lados: a
 * tela mandar retomar com modelo pago alguém que ainda estava dentro do prazo
 * gratuito, e a tela dizer "grátis" para quem já saiu dele.
 */
describe('a porta de entrada gratuita', () => {
  const clicou = (ms: number) => ({ ultimaEntradaEm: atras(ms), portaDeEntradaEm: atras(ms) })

  it('deixa responder no terceiro dia, quando as 24h já venceram há muito', () => {
    const doisDias = clicou(48 * 60 * 60 * 1000)
    expect(dentroDaJanela({ ultimaEntradaEm: doisDias.ultimaEntradaEm }, AGORA)).toBe(false)
    expect(dentroDaJanela(doisDias, AGORA)).toBe(true)
    expect(restaDaJanela(doisDias, AGORA)).toBe(24 * 60 * 60 * 1000)
  })

  it('fecha às 72h, e não antes nem depois', () => {
    expect(dentroDaPortaDeEntrada(clicou(JANELA_DA_PORTA_MS - 1), AGORA)).toBe(true)
    expect(dentroDaPortaDeEntrada(clicou(JANELA_DA_PORTA_MS), AGORA)).toBe(false)
  })

  /**
   * O ponto que separa as duas perguntas, e o motivo de existirem duas funções.
   *
   * Quem clicou no anúncio segunda e voltou a escrever quarta tem a conversa
   * aberta pelas 24h e o prazo gratuito vencido. Responder pode; sair de graça,
   * não. Uma função só diria "grátis" aqui.
   */
  it('conversa reaberta depois das 72h continua aberta e deixa de ser gratuita', () => {
    const reabriu = {
      portaDeEntradaEm: atras(80 * 60 * 60 * 1000),
      ultimaEntradaEm: atras(60 * 60 * 1000),
    }
    expect(dentroDaJanela(reabriu, AGORA)).toBe(true)
    expect(dentroDaPortaDeEntrada(reabriu, AGORA)).toBe(false)
  })

  /**
   * Chegar por link `wa.me`, QR code ou contato salvo na agenda não abre nada
   * disto, mesmo que a pessoa tenha visto o anúncio antes. O que abre é o
   * `referral` que a Meta manda no webhook, e ele não vem nesses casos.
   */
  it('quem não veio de anúncio vale 24h e é pago', () => {
    const semAnuncio = { ultimaEntradaEm: atras(30 * 60 * 60 * 1000), portaDeEntradaEm: null }
    expect(dentroDaJanela(semAnuncio, AGORA)).toBe(false)
    expect(dentroDaPortaDeEntrada(semAnuncio, AGORA)).toBe(false)
  })

  /** Falha fechado também do lado do dinheiro: na dúvida, é pago. */
  it('data ilegível não vira prazo gratuito', () => {
    const ilegivel = { ultimaEntradaEm: atras(60_000), portaDeEntradaEm: 'semana passada' }
    expect(dentroDaPortaDeEntrada(ilegivel, AGORA)).toBe(false)
    expect(restaDaJanela(ilegivel, AGORA)).toBe(JANELA_MS - 60_000)
  })

  /** Anúncio clicado sem a pessoa ter escrito nada não acontece, mas não pode quebrar. */
  it('sobrevive a só ter a porta de entrada', () => {
    const so = { ultimaEntradaEm: null, portaDeEntradaEm: atras(60_000) }
    expect(restaDaJanela(so, AGORA)).toBe(JANELA_DA_PORTA_MS - 60_000)
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
   * Os prazos da Meta são eixos diferentes, e é por isso que `podeReagir` não
   * reusa `JANELA_MS`. Uma mensagem de cinco dias está muito fora da janela de
   * 24h e continua podendo receber reação: se alguém amarrar os dois, reagir
   * para de funcionar em quase toda conversa real.
   */
  it('reagir não depende da janela de 24h', () => {
    const cincoDias = '2026-09-10T12:00:00Z'
    expect(dentroDaJanela({ ultimaEntradaEm: cincoDias }, agora)).toBe(false)
    expect(podeReagir(cincoDias, agora)).toBe(true)
  })

  /* Falha fechado, como `restaDaJanela`: a tela não oferece o que a Meta recusaria. */
  it('data ilegível não pode reagir', () => {
    expect(podeReagir('nao-e-data', agora)).toBe(false)
  })
})
