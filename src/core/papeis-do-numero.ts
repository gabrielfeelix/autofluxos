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
  posAtendimento:
    'Quando alguém da equipe clica em “Atendimento finalizado”. É aqui que entra a pesquisa de satisfação. Vazio: não acontece nada.',
}

/** Um papel que hoje não responde, e por quê. */
export type PapelCalado = {
  papel: PapelDoNumero
  /** `sem_fluxo`: nada escolhido. `rascunho`: escolhido, nunca publicado. */
  motivo: 'sem_fluxo' | 'rascunho'
  fluxoId: string | null
}

/**
 * O resumo "Responde em 3 de 4 situações" do cartão do número (tarefa 6.6).
 *
 * Um papel só **responde** com fluxo escolhido e publicado. Fluxo apagado
 * conta como sem fluxo: o id ficou no canal, mas não há o que rodar.
 */
export function respostasDoNumero(
  escolhidos: Record<PapelDoNumero, string | null>,
  fluxos: { id: string; versaoPublicadaId: string | null }[],
): { respondendo: number; total: number; calados: PapelCalado[] } {
  const calados: PapelCalado[] = []
  for (const papel of PAPEIS_DO_NUMERO) {
    const id = escolhidos[papel]
    const fluxo = id ? fluxos.find((item) => item.id === id) : undefined
    if (!fluxo) calados.push({ papel, motivo: 'sem_fluxo', fluxoId: null })
    else if (!fluxo.versaoPublicadaId) calados.push({ papel, motivo: 'rascunho', fluxoId: fluxo.id })
  }
  return {
    respondendo: PAPEIS_DO_NUMERO.length - calados.length,
    total: PAPEIS_DO_NUMERO.length,
    calados,
  }
}
