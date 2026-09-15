import type { Opcao, TipoDeMidia } from '@/core/flow/schema'

/** O que o canal precisa para entregar um arquivo. Espelha `enviar_midia`. */
export type Midia = {
  midia: TipoDeMidia
  url: string
  legenda?: string
  nomeArquivo?: string
}

/**
 * A mensagem que esta está citando, quando há uma.
 *
 * É o `wa_message_id` da outra — o identificador da Meta, não o nosso. Vai
 * como opcional em todo envio porque citar é escolha de quem responde, e não
 * um tipo de mensagem à parte: o WhatsApp cita texto, foto e PDF igualmente.
 *
 * **O canal que não sabe citar ignora e entrega mesmo assim.** O Instagram não
 * tem o recurso, e transformar isso em erro faria a resposta não sair por causa
 * de um enfeite.
 */
export type Citacao = string

/**
 * A quem o "digitando" se refere.
 *
 * **Os dois campos existem porque os canais pedem coisas diferentes**, e essa
 * diferença só apareceu quando o segundo canal chegou. O WhatsApp liga o
 * indicador respondendo a uma mensagem específica — o mesmo pedido marca como
 * lida e mostra "digitando", e sem o `message_id` a Meta recusa. O Instagram
 * usa `sender_action`, que não sabe nada de mensagem: ele quer saber com quem
 * a conversa é.
 *
 * Passar só o id da mensagem, como era antes, obrigaria o adaptador do
 * Instagram a adivinhar o destinatário a partir dele — informação que ele não
 * tem. Passar os dois deixa cada canal usar o que precisa e nenhum inventar
 * nada.
 */
export type AlvoDoIndicador = {
  /** Id da mensagem que chegou. É o que o WhatsApp exige. */
  mensagemId: string
  /** Id de quem está do outro lado. É o que o Instagram exige. */
  contato: string
}

/**
 * Por onde as mensagens saem.
 *
 * O motor nunca conhece este arquivo: ele descreve ações, e quem executa é um
 * canal. Trocar o WhatsApp por outra coisa é escrever outra implementação —
 * nada em `core/` muda.
 */
export type Canal = {
  /** Mostra "digitando" quando houver suporte e segura a resposta pelo prazo. */
  aguardarResposta(alvo: AlvoDoIndicador, atrasoMs: number): Promise<void>
  enviarTexto(para: string, texto: string, citando?: Citacao): Promise<void>
  enviarOpcoes(
    para: string,
    texto: string,
    opcoes: Opcao[],
    formato: 'botoes' | 'lista',
  ): Promise<void>
  enviarMidia(para: string, midia: Midia, citando?: Citacao): Promise<void>
  /**
   * Reage a uma mensagem com um emoji. String vazia **remove** a reação.
   *
   * Opcional na interface, e não em todos os canais: só o WhatsApp tem o
   * recurso. Quem chama pergunta se existe antes — o mesmo que já se faz com
   * qualquer coisa que um canal tenha e o outro não.
   *
   * O teto de 30 dias da Meta não é conferido aqui: o adaptador é o último
   * ponto antes da rede, e recusar em silêncio seria pior que a recusa dela,
   * que ao menos vem com motivo. Quem desenha a tela é que precisa esconder o
   * botão — ver `PODE_REAGIR_ATE_DIAS`.
   */
  reagir?(para: string, mensagemId: string, emoji: string): Promise<void>
}
