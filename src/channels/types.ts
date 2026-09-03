import type { Opcao, TipoDeMidia } from '@/core/flow/schema'

/** O que o canal precisa para entregar um arquivo. Espelha `enviar_midia`. */
export type Midia = {
  midia: TipoDeMidia
  url: string
  legenda?: string
  nomeArquivo?: string
}

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
  enviarTexto(para: string, texto: string): Promise<void>
  enviarOpcoes(
    para: string,
    texto: string,
    opcoes: Opcao[],
    formato: 'botoes' | 'lista',
  ): Promise<void>
  enviarMidia(para: string, midia: Midia): Promise<void>
}
