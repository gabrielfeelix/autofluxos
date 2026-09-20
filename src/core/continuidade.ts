import { z } from 'zod'

/**
 * A continuidade entre processos (RB-25).
 *
 * Concluir o SDR pode abrir a oportunidade comercial; concluir a venda pode
 * abrir o pós-venda. Aqui mora só o que é regra pura: a chave que identifica a
 * intenção e a forma dos dados que viajam na fila.
 *
 * Por que a chave é **por conclusão**, e não por (contato, quadro de destino):
 * quem comprou duas vezes tem duas conclusões e merece que a segunda também
 * seja tentada. Chave por par contato/destino trataria a recompra como
 * repetição da primeira compra e engoliria a intenção nova — exatamente o
 * defeito que a 0071 existe para desfazer (A12).
 */

export function chaveDaContinuidade(conclusaoId: string): string {
  return `continuidade:${conclusaoId}`
}

/**
 * O que a tarefa carrega.
 *
 * Só o id da conclusão, de propósito. Tudo o mais — contato, destino,
 * responsável, título — é lido do banco na hora de executar, porque a tarefa
 * pode rodar minutos depois e o estado da época já está gravado na própria
 * conclusão. Copiar os campos para dentro da fila criaria uma segunda verdade
 * que envelhece sozinha.
 */
export const dadosDaContinuidadeSchema = z.object({
  conclusaoId: z.string().uuid(),
})

export type DadosDaContinuidade = z.infer<typeof dadosDaContinuidadeSchema>
