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

export const TIPOS_DE_TAREFA = ['timeout_de_pergunta', 'passo_de_sequencia'] as const

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

/**
 * Um passo de sequência venceu (0031).
 *
 * Guarda a **inscrição** e o índice do passo, e a dupla é o que evita o pior
 * erro daqui: uma tarefa velha chegando depois de a pessoa já ter avançado
 * mandaria de novo uma mensagem que ela já recebeu. Com o índice registrado, o
 * passo só sai se a inscrição ainda estiver exatamente onde estava.
 *
 * `entrouEm` viaja junto porque o horário dos passos seguintes é contado **do
 * evento**, não do agora — ver `quandoRodaOPasso`. Recontar a cada passo
 * empurraria a sequência para a frente a cada atraso do agendador, e o passo de
 * 20h chegaria fora da janela de 24h por causa de uma passada que demorou.
 */
export const dadosDoPassoSchema = z.object({
  inscricaoId: z.string().uuid(),
  sequenciaId: z.string().uuid(),
  contatoId: z.string().uuid(),
  passoIndice: z.number().int().min(0),
  entrouEm: z.string().min(1),
})

export type DadosDoPasso = z.infer<typeof dadosDoPassoSchema>

/**
 * Uma tarefa pendente por inscrição, e não por passo.
 *
 * A inscrição está num passo de cada vez, e o próximo só é agendado depois de o
 * anterior sair. Chave por (inscrição, passo) deixaria duas vivas no momento em
 * que um reagendamento acontecesse, e a pessoa receberia dois passos juntos.
 */
export function chaveDoPasso(inscricaoId: string): string {
  return `sequencia:${inscricaoId}`
}
