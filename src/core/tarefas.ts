import { z } from 'zod'

/**
 * O que o agendador sabe fazer (0026).
 *
 * O tipo é texto no banco de propósito — `enum` do Postgres exigiria migration
 * para cada tipo novo, e tipo de tarefa é o que mais vai crescer. A lista
 * fechada mora aqui, e o executor **recusa o que não conhece** em vez de
 * estourar: uma tarefa de um tipo que a versão em produção ainda não entende é
 * um deploy pela metade, não uma falha.
 */

export const TIPOS_DE_TAREFA = ['timeout_de_pergunta'] as const

export type TipoDeTarefa = (typeof TIPOS_DE_TAREFA)[number]

export function ehTipoDeTarefa(valor: string): valor is TipoDeTarefa {
  return (TIPOS_DE_TAREFA as readonly string[]).includes(valor)
}

/**
 * O prazo de uma pergunta acabou.
 *
 * Guarda a sessão **e o nó**, e é a segunda parte que evita o pior erro
 * possível aqui: uma tarefa velha chegando depois de a conversa ter andado
 * empurraria alguém de um bloco em que ela não está mais. Com o nó registrado,
 * a tarefa só age se a conversa ainda estiver exatamente onde estava.
 */
export const dadosDoTimeoutSchema = z.object({
  sessaoId: z.string().uuid(),
  contatoId: z.string().uuid(),
  noId: z.string().min(1),
})

export type DadosDoTimeout = z.infer<typeof dadosDoTimeoutSchema>

/**
 * A chave de deduplicação de um timeout.
 *
 * Uma por sessão, e não uma por (sessão, nó): a conversa está num nó de cada
 * vez, e a intenção mais nova é sempre a que vale. Sem isso, um fluxo que
 * repergunta deixaria dois timeouts vivos e a pessoa receberia a cobrança duas
 * vezes — defeito que só aparece com gente de verdade do outro lado.
 */
export function chaveDoTimeout(sessaoId: string): string {
  return `timeout:${sessaoId}`
}
