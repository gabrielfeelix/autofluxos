/**
 * O contrato com o modelo.
 *
 * Mesma forma do `channels/`: uma interface pequena, um adaptador de verdade e
 * um de mentira. O resto do sistema fala com a interface, então trocar Gemini
 * por outro provedor — ou rodar teste sem rede — é escolher outra implementação,
 * não mexer no motor.
 */

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
}

export type Turno = { de: 'pessoa' | 'bot'; texto: string }

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

export type Modelo = {
  responder(pedido: PedidoDeIa): Promise<Resposta>
}
