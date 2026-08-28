/**
 * O contrato com o modelo.
 *
 * Mesma forma do `channels/`: uma interface pequena, um adaptador de verdade e
 * um de mentira. O resto do sistema fala com a interface, então trocar Gemini
 * por outro provedor — ou rodar teste sem rede — é escolher outra implementação,
 * não mexer no motor.
 */

import type { Ferramenta } from '@/core/ferramentas'

export type PedidoDeIa = {
  /**
   * O que o cliente escreveu sobre o próprio negócio (`clients.contexto_negocio`):
   * o que vende, preço, horário, o que responder e o que não responder.
   *
   * É isto que fecha o escopo. Sem contexto, o nó de IA vira assistente de
   * propósito geral — que é justamente o que a política da Meta proíbe na
   * Business API desde 15/jan/2026 (§6 da arquitetura).
   */
  contextoNegocio: string
  /** A instrução do bloco, já interpolada pelo motor. */
  instrucao: string
  /** A última coisa que a pessoa escreveu. */
  pergunta: string
  /** A conversa até aqui, do mais antigo para o mais novo. */
  historico?: Turno[]
  /**
   * O que este nó autorizou a IA a consultar. Vazio = a IA de sempre, texto
   * puro sobre o contexto do negócio.
   */
  ferramentas?: Ferramenta[]
  /**
   * Que dia é hoje, em `AAAA-MM-DD`.
   *
   * **Sem isto o modelo não tem relógio, e "amanhã" não vira data.** `core/`
   * não tem relógio de propósito e o modelo herda a cegueira; a diferença é
   * que ele não avisa — ele chuta um ano e marca a aula onze meses fora.
   * Quem informa é o resolvedor, que é onde o mundo entra.
   */
  hoje?: string
}

export type Turno =
  | { de: 'pessoa' | 'bot'; texto: string }
  /**
   * O que uma ferramenta devolveu, na conversa que o modelo lê.
   *
   * É um `de` próprio, e não um turno de bot com o JSON dentro, porque o
   * modelo precisa saber que isto é **dado**, e nunca instrução. Campo de CRM
   * com "ignore as instruções anteriores" escrito dentro é injeção indireta, e
   * é o vetor que mais cresce em agente com integração. Separar a origem é o
   * que permite ao prompt de sistema dizer, com endereço, de onde não se
   * aceita ordem.
   */
  | { de: 'ferramenta'; nome: string; texto: string }

/**
 * O que o modelo devolveu.
 *
 * `nao_sei` não é erro: é a saída de emergência do §6 e o caminho normal para
 * qualquer coisa fora do escopo do negócio. Quem recebe transforma isso em
 * handoff — a pessoa fala com gente em vez de ouvir o bot inventar.
 */
export type Resposta =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'nao_sei'; motivo: string }
  /**
   * "Antes de responder, preciso consultar isto."
   *
   * Quem executa é o resolvedor, nunca o adaptador: é lá que estão a
   * credencial, a conferência de endereço e as travas. O adaptador só traduz o
   * que o modelo pediu.
   *
   * `argumentos` chega **como o modelo mandou**, sem confiança nenhuma
   * embutida: pode ter nome que não existe, pode ter um `pessoa_id` que ele
   * inventou, pode faltar o obrigatório. Conferir é trabalho de quem executa.
   */
  | { tipo: 'usar_ferramenta'; nome: string; argumentos: Record<string, string> }

export type Modelo = {
  responder(pedido: PedidoDeIa): Promise<Resposta>
}
