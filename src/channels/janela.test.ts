import { describe, expect, it } from 'vitest'
import {
  comoFalta,
  dentroDaJanela,
  dentroDaPortaDeEntrada,
  JANELA_DA_PORTA_MS,
  JANELA_MS,
  permissaoDeEnvio,
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

  /**
   * **Este teste afirmava o contrário, e o contrário estava errado.**
   *
   * Ele dizia "deixa responder no terceiro dia", e era verdade no código: a
   * porta de 72h estendia a janela de texto livre. A documentação da Meta,
   * consultada em 19/set e citada no bloco lá embaixo, diz sem margem que a
   * janela de atendimento é **independente** da porta gratuita: fechada ela,
   * só sai modelo aprovado.
   *
   * O que continua verdade é a metade do dinheiro: no terceiro dia o envio
   * ainda é gratuito. Só que gratuito por modelo, e não texto livre.
   */
  it('no terceiro dia NÃO deixa texto livre, e ainda é gratuito', () => {
    const doisDias = clicou(48 * 60 * 60 * 1000)

    // A janela de 24h venceu, e a porta não a estende mais.
    expect(dentroDaJanela(doisDias, AGORA)).toBe(false)
    // O dinheiro é outra conta, e ela segue aberta.
    expect(dentroDaPortaDeEntrada(doisDias, AGORA)).toBe(true)

    const permissao = permissaoDeEnvio(doisDias, AGORA)
    expect(permissao.textoLivre).toBe(false)
    expect(permissao.cobranca).toBe('gratuita')
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

  /**
   * Anúncio clicado sem a pessoa ter escrito nada: o caso mais comum do lead de
   * anúncio, e o que o defeito abria indevidamente.
   *
   * `restaDaJanela` devolve `null` e não um prazo: não existe janela de 24h
   * aberta, nem uma que já fechou. A tela mostra "responda por modelo" em vez de
   * um contador de três dias que a Meta não honra.
   */
  it('só a porta de entrada não dá prazo de texto livre nenhum', () => {
    const so = { ultimaEntradaEm: null, portaDeEntradaEm: atras(60_000) }
    expect(restaDaJanela(so, AGORA)).toBeNull()
    expect(dentroDaJanela(so, AGORA)).toBe(false)
    // E o envio por modelo sai de graça, que é o que a porta de fato concede.
    expect(dentroDaPortaDeEntrada(so, AGORA)).toBe(true)
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

// ---------------------------------------------------------------------------
// O que a regra da Meta diz, e o que este arquivo ainda não faz
// ---------------------------------------------------------------------------

/**
 * A divergência das fontes, resolvida na documentação oficial (19/set/2026).
 *
 * A análise de 19/set registrou que Salesforce e 360dialog não convergiam sobre
 * texto livre dentro das 72h, e que a documentação técnica da Meta havia
 * respondido 429. Ela foi consultada por outro caminho e responde sem margem,
 * na página de preços vigente:
 *
 *   "the customer service window is **independent of the FEP window**, so if
 *    the customer service window closes, you will only be able to send
 *    template messages."
 *
 * E, na página de preços por conversa, com exemplo numérico:
 *
 *   "You can send template messages at no charge in those 72 hours. You can
 *    send non-template messages until 10am the next day, at which point the
 *    customer service window closes, as it is independent of the free entry
 *    point conversation."
 *
 * Quer dizer: **as 72h são sobre dinheiro, não sobre permissão de texto livre.**
 * Quem manda no texto livre é sempre a janela de 24h, contada da última
 * mensagem da pessoa. A Salesforce estava certa.
 *
 * Duas consequências para este módulo. **A primeira foi corrigida pela T3.3**, e
 * os testes abaixo são a prova dela:
 *
 * 1. `restaDaJanela` devolvia o **maior** dos dois prazos, então um contato que
 *    chegou por anúncio e nunca escreveu aparecia com janela aberta por 72h. Ela
 *    abria o compositor de texto livre para uma mensagem que a Meta recusa com
 *    `(#131047) Re-engagement message`. Agora ela conta só as 24h.
 * 2. A própria janela gratuita só existe se a empresa **responder em até 24h**
 *    do clique. Sem resposta, ela nunca abre, e o código ainda não sabe disso,
 *    porque não guarda se houve resposta. **Continua pendente**, e está
 *    registrado no handoff: é conservador na direção certa (mostrar "gratuita"
 *    para uma conversa que ainda pode virar paga informa a mais, não autoriza a
 *    mais), mas segue sendo uma promessa de custo que não foi verificada.
 */
describe('as 72h do anúncio não autorizam texto livre', () => {
  const chegouPorAnuncio = (ms: number) => ({
    ultimaEntradaEm: null,
    portaDeEntradaEm: atras(ms),
  })

  /**
   * O caso central, corrigido. A pessoa clicou no anúncio e **nunca escreveu**:
   * não existe janela de atendimento, logo não cabe texto livre. O caminho dela
   * é modelo aprovado, e o envio sai de graça por causa da porta.
   */
  it('quem só clicou no anúncio não ganha texto livre (RB-13)', () => {
    const doisDias = 2 * 24 * 60 * 60 * 1000
    const janela = chegouPorAnuncio(doisDias)

    expect(dentroDaJanela(janela, AGORA)).toBe(false)
    // E não há prazo a mostrar, porque a janela de 24h nunca chegou a existir.
    expect(restaDaJanela(janela, AGORA)).toBeNull()

    /*
     * As duas respostas, lado a lado, que é o ponto da separação: não pode
     * mandar texto livre, **e** o que ela mandar por modelo sai de graça.
     */
    const permissao = permissaoDeEnvio(janela, AGORA)
    expect(permissao.textoLivre).toBe(false)
    expect(permissao.causa).toBe('nunca_escreveu')
    expect(permissao.cobranca).toBe('gratuita')
  })

  /**
   * Mesmo no primeiro minuto depois do clique. O erro anterior era sobre o
   * relógio errado, não sobre o prazo ser curto ou longo.
   */
  it('nem no minuto seguinte ao clique', () => {
    expect(dentroDaJanela(chegouPorAnuncio(60_000), AGORA)).toBe(false)
  })

  /**
   * A parte que já está certa e precisa continuar: a pergunta do dinheiro é
   * separada, e `dentroDaPortaDeEntrada` a responde sozinha.
   */
  it('a janela gratuita é uma pergunta sobre cobrança, e essa parte já separa', () => {
    const umDia = 24 * 60 * 60 * 1000
    expect(dentroDaPortaDeEntrada(chegouPorAnuncio(umDia), AGORA)).toBe(true)
    expect(dentroDaPortaDeEntrada(chegouPorAnuncio(JANELA_DA_PORTA_MS + 1), AGORA)).toBe(false)
  })

  /**
   * O que a correção precisa preservar: quem clicou no anúncio **e escreveu**
   * tem a janela de 24h por direito próprio, contada da mensagem dela.
   */
  it('quem clicou e escreveu tem a janela de 24h pela mensagem, não pelo anúncio', () => {
    const janela = {
      ultimaEntradaEm: atras(60_000),
      portaDeEntradaEm: atras(2 * 24 * 60 * 60 * 1000),
    }
    expect(dentroDaJanela(janela, AGORA)).toBe(true)
    // E continua gratuita, porque as 72h ainda correm.
    expect(dentroDaPortaDeEntrada(janela, AGORA)).toBe(true)

    const permissao = permissaoDeEnvio(janela, AGORA)
    expect(permissao.textoLivre).toBe(true)
    expect(permissao.cobranca).toBe('gratuita')
  })
})

/**
 * As três informações da 5.3, separadas: permissão, causa e cobrança.
 *
 * Elas existem juntas num objeto porque a tela erra quando trata uma como
 * resposta da outra, e foi exatamente assim que as 72h viraram autorização de
 * texto livre.
 */
describe('permissaoDeEnvio', () => {
  it('quem escreveu agora pode texto livre, e o custo é desconhecido', () => {
    const permissao = permissaoDeEnvio({ ultimaEntradaEm: atras(60_000) }, AGORA)
    expect(permissao.textoLivre).toBe(true)
    expect(permissao.causa).toBeNull()
    /*
     * `desconhecido` e não `paga`: fora das 72h o preço depende da categoria do
     * modelo, e isso não é conta sobre tempo. A tela diz "Não confirmado" em vez
     * de prometer um custo que ninguém calculou.
     */
    expect(permissao.cobranca).toBe('desconhecido')
  })

  it('quem escreveu há mais de 24h tem a janela fechada, e a causa diz qual', () => {
    const permissao = permissaoDeEnvio({ ultimaEntradaEm: atras(JANELA_MS + 1000) }, AGORA)
    expect(permissao.textoLivre).toBe(false)
    // 'janela_fechada' e não 'nunca_escreveu': são ações diferentes de quem atende.
    expect(permissao.causa).toBe('janela_fechada')
  })

  it('quem nunca escreveu tem causa própria', () => {
    expect(permissaoDeEnvio({ ultimaEntradaEm: null }, AGORA).causa).toBe('nunca_escreveu')
  })

  /**
   * Passou das 72h e a pessoa respondeu: dá para escrever, e agora custa. É o
   * caso que a separação existe para representar, e o que a tela precisava
   * dizer e não dizia.
   */
  it('porta vencida com mensagem recente: texto livre sim, e pago', () => {
    const permissao = permissaoDeEnvio(
      {
        ultimaEntradaEm: atras(60_000),
        portaDeEntradaEm: atras(JANELA_DA_PORTA_MS + 1000),
      },
      AGORA,
    )
    expect(permissao.textoLivre).toBe(true)
    expect(permissao.cobranca).toBe('paga')
  })

  /** A borda exata do prazo: no milissegundo do vencimento já não vale. */
  it('no instante exato das 24h a janela já fechou', () => {
    expect(permissaoDeEnvio({ ultimaEntradaEm: atras(JANELA_MS) }, AGORA).textoLivre).toBe(false)
    expect(permissaoDeEnvio({ ultimaEntradaEm: atras(JANELA_MS - 1000) }, AGORA).textoLivre).toBe(true)
  })

  /** Data ilegível falha fechado, como `restaDe`. */
  it('data ilegível não vira janela aberta', () => {
    const permissao = permissaoDeEnvio({ ultimaEntradaEm: 'nao-e-data' }, AGORA)
    expect(permissao.textoLivre).toBe(false)
  })
})
