/**
 * O aceite e a saída das promoções (0059, `public.consentimentos`).
 *
 * ---------------------------------------------------------------------------
 * Por que existe
 * ---------------------------------------------------------------------------
 *
 * A Meta exige duas coisas de quem manda marketing pelo WhatsApp: aceite
 * registrado antes, e um jeito simples de sair depois. Sem a segunda, quem não
 * quer mais bloqueia o número ou denuncia, e é a qualidade do número **do
 * cliente** que cai, até a Meta limitar os envios dele. Honrar o "SAIR" é o que
 * protege o número.
 *
 * Mora em `core/` porque três pontas precisam dele: o recebimento (que
 * reconhece a palavra), a transmissão (que exclui quem saiu) e a ficha (que
 * mostra o estado). Nada aqui toca banco.
 */

/**
 * As frases que, **sozinhas**, pedem para sair das promoções.
 *
 * Só valem como mensagem inteira, pela regra de `PALAVRAS_DE_SAIDA_DA_IA`:
 * "quero sair às 8" é conversa, "SAIR" sozinho não tem outra leitura. A
 * mensagem inteira é o que a Meta e o mercado esperam quando o rodapé do
 * modelo diz "responda SAIR".
 *
 * **"cancelar" fica de fora de propósito.** Sozinho, ele quase sempre é
 * "cancelar a aula" ou "cancelar o pedido", e tirar alguém das promoções por
 * isso seria responder outra pergunta.
 *
 * "sair" e "parar" também encerram a conversa com a IA (`executar.ts`). Quando
 * as duas leituras cabem, vence a saída das promoções: mandar promoção para
 * quem pediu para parar é o erro que custa o número, e deixar de mandar para
 * quem só queria sair da IA é o erro barato. A confirmação diz que o
 * atendimento continua, para a pessoa saber que pode seguir escrevendo.
 *
 * "parar promoções" e "stop promotions" são o botão que a própria Meta põe nos
 * modelos de marketing: ele chega como resposta de botão, com esse texto.
 */
export const PALAVRAS_DE_SAIDA_DO_MARKETING = [
  'sair',
  'parar',
  'stop',
  'parar promocoes',
  'parar de receber',
  'stop promotions',
  'descadastrar',
  'cancelar inscricao',
] as const

/** Minúsculo, sem acento, sem pontuação nas pontas, espaços colapsados. */
export function normalizarPedido(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A mensagem inteira é um pedido de saída das promoções? */
export function ehPedidoDeSaida(texto: string | null | undefined): boolean {
  if (!texto || texto.length > 40) return false
  const limpo = normalizarPedido(texto)
  return (PALAVRAS_DE_SAIDA_DO_MARKETING as readonly string[]).includes(limpo)
}

/**
 * A resposta a quem pediu para sair.
 *
 * Diz o que mudou e o que **não** mudou: sem a segunda frase, quem só queria
 * parar as promoções entende que perdeu o atendimento junto.
 */
export const CONFIRMACAO_DA_SAIDA =
  'Pronto, você não vai mais receber promoções por este número. O atendimento continua normal: é só escrever quando precisar.'

/**
 * O texto da caixa de aceite do chat do site.
 *
 * É **este** texto que fica gravado em `texto_exibido`, e é por isso que ele
 * sai do servidor para o balão, e não mora escrito no balão: o que a pessoa leu
 * e o que ficou de prova precisam ser a mesma string, e duas cópias acabam
 * divergindo.
 */
export const TEXTO_DO_ACEITE_DO_SITE =
  'Aceito receber mensagens desta empresa pelo WhatsApp, inclusive novidades e ofertas. Posso parar quando quiser respondendo SAIR.'

/**
 * Onde a pessoa disse sim ou não.
 *
 * A coluna é texto livre (0059); esta lista é o que este código escreve.
 * `mensagem` é o "SAIR" na conversa; `meta` é a Meta recusando o envio porque a
 * pessoa parou as promoções pelo próprio WhatsApp.
 */
export type OrigemDoConsentimento = 'mensagem' | 'site' | 'lead_ads' | 'manual' | 'fluxo' | 'importacao' | 'meta'

/** A linha mais recente de MARKETING de um contato. `null` = nunca houve registro. */
export type EstadoDoMarketing = {
  aceito: boolean
  origem: string
  em: string
} | null

const ORIGEM_EM_PALAVRAS: Record<string, string> = {
  mensagem: 'pediu pela conversa',
  site: 'pelo chat do site',
  lead_ads: 'pelo formulário do anúncio',
  manual: 'marcado pela equipe',
  fluxo: 'pelo fluxo',
  importacao: 'na importação',
  meta: 'pelo próprio WhatsApp',
}

export function origemEmPalavras(origem: string): string {
  return ORIGEM_EM_PALAVRAS[origem] ?? origem
}

/** Recebe promoções? Sem registro, recebe, como sempre recebeu. */
export function recebePromocoes(estado: EstadoDoMarketing): boolean {
  return estado === null || estado.aceito
}

/** O evento `consentimento` da linha do tempo, em frase que se lê sozinha. */
export function fraseDoConsentimento(aceito: boolean, origem: string): string {
  if (aceito) {
    if (origem === 'manual') return 'a equipe marcou que voltou a aceitar promoções'
    return `aceitou receber promoções ${origemEmPalavras(origem)}`
  }
  if (origem === 'mensagem') return 'pediu para não receber promoções'
  if (origem === 'meta') return 'parou as promoções pelo próprio WhatsApp'
  if (origem === 'manual') return 'a equipe marcou que não quer promoções'
  return `recusou promoções ${origemEmPalavras(origem)}`
}
