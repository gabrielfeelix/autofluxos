import type { Fluxo } from './flow/schema'

/**
 * A conversa de agora, e só ela.
 *
 * Pedido do Gabriel em 19/out/2026, olhando a Sueli (PCYES): ao devolver a
 * conversa para o bot, ele respondeu só a última mensagem com uma pergunta
 * genérica, como se não tivesse lido nada do que veio antes. O bot tem que ler
 * a conversa **desde que ela foi aberta de novo** e continuar dali, e não ler
 * o que a pessoa falou há dois anos.
 *
 * As últimas 10 mensagens, que era o que a IA recebia, erravam dos dois lados:
 * numa conversa movimentada cortavam a pergunta que ainda estava sem resposta,
 * e num contato que voltou depois de meses traziam a conversa antiga misturada
 * com a nova.
 */

/** Silêncio que separa uma conversa da outra: a pessoa voltou outro dia. */
export const PAUSA_ENTRE_CONVERSAS_MS = 24 * 60 * 60 * 1000

/** O máximo que a IA lê, para uma conversa muito longa não estourar o custo. */
export const TETO_DA_CONVERSA_ATUAL = 40

/**
 * Folga antes da abertura: a mensagem que abriu a sessão chegou **antes** de
 * ela ser criada, e a rajada que a acompanha também.
 */
export const FOLGA_DA_ABERTURA_MS = 5 * 60 * 1000

/**
 * Corta as mensagens (em ordem, da mais velha para a mais nova) no começo da
 * conversa atual: a última pausa de 24h ou a abertura da conversa pelo bot, o
 * que for mais recente.
 */
export function recortarConversaAtual<T extends { ts: string }>(mensagens: T[], abertaEm: Date | null): T[] {
  const limite = abertaEm ? abertaEm.getTime() - FOLGA_DA_ABERTURA_MS : -Infinity
  const tempos = mensagens.map((m) => Date.parse(m.ts))
  let inicio = tempos.length
  let seguinte: number | null = null
  for (let i = tempos.length - 1; i >= 0; i--) {
    const ts = tempos[i] ?? NaN
    if (ts < limite) break
    if (seguinte !== null && seguinte - ts >= PAUSA_ENTRE_CONVERSAS_MS) break
    inicio = i
    seguinte = ts
  }
  return mensagens.slice(inicio)
}

/**
 * As variáveis que guardam uma **decisão** da conversa, e não um dado da pessoa.
 *
 * O botão escolhido no menu e o rótulo que a IA deu ao assunto ficam gravados
 * no contato, porque são coluna na tela de leads. Na conversa retomada eles
 * mentem: a Sueli tocou "Quero comprar" às 17:41, e às 18:07 o fluxo de vendas
 * leu aquele `assunto` velho como "acabou de tocar o botão" e mandou de novo a
 * pergunta de abertura, em vez de deixar a IA ler a conversa.
 *
 * Fica o que a pessoa escreveu (nome, CPF, pedido): isso é dela e continua
 * valendo. Sai o que o fluxo decidiu por ela: escolha de botão e saída de IA.
 */
export function variaveisDeDecisao(grafo: Fluxo): Set<string> {
  const nomes = new Set<string>()
  for (const no of grafo.nodes) {
    if (no.type === 'pergunta' && (no.data.opcoes.length > 0 || no.data.opcoesDe)) {
      for (const v of [no.data.salvarEm, no.data.salvarValorEm, no.data.salvarPadraoEm]) if (v) nomes.add(v)
    }
    if (no.type === 'ia') {
      if (no.data.salvarEm) nomes.add(no.data.salvarEm)
      if (no.data.conversar?.concluir?.salvarEm) nomes.add(no.data.conversar.concluir.salvarEm)
    }
  }
  return nomes
}

/** As variáveis iniciais de uma conversa retomada, sem as decisões da anterior. */
export function semDecisoesAntigas(vars: Record<string, string>, grafo: Fluxo): Record<string, string> {
  const decisoes = variaveisDeDecisao(grafo)
  return Object.fromEntries(Object.entries(vars).filter(([nome]) => !decisoes.has(nome)))
}
