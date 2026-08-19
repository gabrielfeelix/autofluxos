/**
 * Os quatro papéis que um número do WhatsApp pode dar a um fluxo (A6, 0024).
 *
 * Vocabulário, e por isso mora em `core/`: a tela do número, a tela de fluxos e
 * o servidor precisam chamar as mesmas quatro coisas pelos mesmos quatro nomes.
 * Onde cada papel é **guardado** é decisão do banco e fica no repo.
 */

export const PAPEIS_DO_NUMERO = ['principal', 'boasVindas', 'midia', 'posAtendimento'] as const

export type PapelDoNumero = (typeof PAPEIS_DO_NUMERO)[number]

export const ROTULO_DO_PAPEL: Record<PapelDoNumero, string> = {
  principal: 'Principal',
  boasVindas: 'Boas-vindas',
  midia: 'Mídia recebida',
  posAtendimento: 'Pós-atendimento',
}

/**
 * O que cada papel faz, na tela, em uma frase.
 *
 * Escrito em termos do que a **pessoa do outro lado** vive, e não do que o
 * sistema faz: "quando alguém manda áudio, foto ou PDF" diz quando escolher
 * isto; "executa o fluxo de mídia" não diz nada a quem está configurando.
 */
export const EXPLICACAO_DO_PAPEL: Record<PapelDoNumero, string> = {
  principal: 'A resposta padrão. Roda quando nenhum dos outros casos acontece.',
  boasVindas: 'Só na primeira conversa de cada pessoa neste número.',
  midia: 'Quando chega áudio, foto, figurinha ou PDF. Vazio: a conversa vai para uma pessoa.',
  posAtendimento: 'Quando alguém da equipe clica em “Já atendi”.',
}
