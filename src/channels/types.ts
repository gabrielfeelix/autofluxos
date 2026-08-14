import type { Opcao } from '@/core/flow/schema'

/**
 * Por onde as mensagens saem.
 *
 * O motor nunca conhece este arquivo: ele descreve ações, e quem executa é um
 * canal. Trocar o WhatsApp por outra coisa é escrever outra implementação —
 * nada em `core/` muda.
 */
export type Canal = {
  /** Mostra "digitando" quando houver suporte e segura a resposta pelo prazo. */
  aguardarResposta(mensagemId: string, atrasoMs: number): Promise<void>
  enviarTexto(para: string, texto: string): Promise<void>
  enviarOpcoes(
    para: string,
    texto: string,
    opcoes: Opcao[],
    formato: 'botoes' | 'lista',
  ): Promise<void>
}
