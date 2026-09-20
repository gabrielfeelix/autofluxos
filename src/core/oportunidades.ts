/**
 * Finalidade do processo, resultado da ocorrência e o que é venda (0071).
 *
 * ---------------------------------------------------------------------------
 * O problema que este arquivo resolve
 * ---------------------------------------------------------------------------
 *
 * Até aqui, `situacao = 'ganha'` num cartão queria dizer duas coisas ao mesmo
 * tempo: "este trabalho terminou bem" e "esta pessoa comprou". Os modelos de
 * `quadros-modelos.ts` marcam como `ganho` a etapa final do Atendimento
 * ("Resolvido"), da Captação ("Qualificado") e da Agenda ("Compareceu") — e
 * nenhuma delas é compra. Como `repos/crm.ts` deriva compra de cartão ganho, a
 * clínica que respondeu dez dúvidas aparecia com dez compras.
 *
 * A separação está na proposta de 19/set (RB-03, RB-05, RB-23):
 *
 *   **finalidade** do processo  → comercial ou operacional
 *   **resultado** da ocorrência → o que aconteceu, na linguagem da finalidade
 *   **venda**                   → registro próprio, só em processo comercial
 *
 * Puro e sem rede, como todo `core/`: quem grava é `repos/`, quem decide é aqui.
 */

// ---------------------------------------------------------------------------
// Finalidade
// ---------------------------------------------------------------------------

/**
 * Para que serve um processo.
 *
 * `operacional` é o padrão de quem não escolheu, e é a escolha conservadora: um
 * processo que ninguém classificou não pode começar produzindo receita. O
 * caminho seguro do desconhecido é não virar venda (RB-06).
 */
export const FINALIDADES = ['operacional', 'comercial'] as const

export type Finalidade = (typeof FINALIDADES)[number]

export const FINALIDADE_PADRAO: Finalidade = 'operacional'

export function ehFinalidade(valor: unknown): valor is Finalidade {
  return typeof valor === 'string' && (FINALIDADES as readonly string[]).includes(valor)
}

/** Como a finalidade se chama na tela. */
export const NOME_DA_FINALIDADE: Record<Finalidade, string> = {
  operacional: 'acompanhamento',
  comercial: 'venda',
}

/**
 * O que cada finalidade explica sobre si mesma, para a tela de criar processo.
 *
 * Escrito do ponto de vista de quem escolhe, e não do modelo de dados: a
 * pergunta que a pessoa tem na cabeça é "isso aqui é venda ou não".
 */
export const EXPLICACAO_DA_FINALIDADE: Record<Finalidade, string> = {
  operacional:
    'acompanhar um trabalho até o fim: atendimento, qualificação, agendamento, pós-venda. Concluir não registra venda.',
  comercial:
    'negociar uma venda. Concluir com ganho exige registrar a venda, com data e valor quando conhecidos.',
}

// ---------------------------------------------------------------------------
// Resultado da ocorrência
// ---------------------------------------------------------------------------

/**
 * Como uma ocorrência termina.
 *
 * `concluida` e `cancelada` valem para as duas finalidades. `ganha` e `perdida`
 * são **só de processo comercial**: são os rótulos que a proposta reserva à
 * oportunidade (RB-23, "os rótulos Ganhar/Perder ficam restritos à oportunidade
 * comercial").
 *
 * Note o que sumiu: não existe "ganha" operacional. Concluir um atendimento é
 * `concluida`, e nada mais.
 */
export const SITUACOES_DA_OCORRENCIA = [
  'aberta',
  'concluida',
  'cancelada',
  'ganha',
  'perdida',
] as const

export type SituacaoDaOcorrencia = (typeof SITUACOES_DA_OCORRENCIA)[number]

/** Esta situação pode existir num processo desta finalidade? */
export function situacaoCabeNaFinalidade(
  situacao: SituacaoDaOcorrencia,
  finalidade: Finalidade,
): boolean {
  if (situacao === 'ganha' || situacao === 'perdida') return finalidade === 'comercial'
  return true
}

/**
 * **A regra central desta fase: isto conta como compra?**
 *
 * Só conta o que for `ganha` **e** de processo comercial. Um atendimento
 * concluído, uma qualificação aprovada e um comparecimento confirmado são
 * sucesso operacional e não movem receita nenhuma.
 *
 * Mesmo `ganha` em processo comercial **não basta** para haver compra: a venda
 * precisa existir como registro próprio e válido (RB-05). Esta função responde
 * "pode contar", e quem responde "contou" é `vendas.ts`.
 */
export function contaComoCompra(
  situacao: SituacaoDaOcorrencia,
  finalidade: Finalidade,
): boolean {
  return situacao === 'ganha' && finalidade === 'comercial'
}

/**
 * O que uma etapa terminal produz quando alguém arrasta o cartão para ela.
 *
 * É o que decide qual formulário abre (RB-23): em processo comercial, a etapa
 * de ganho pede **registrar venda**; em operacional, ela conclui e pronto.
 */
export type AcaoDeFechamento =
  | { tipo: 'concluir' }
  | { tipo: 'cancelar' }
  | { tipo: 'registrar-venda' }
  | { tipo: 'marcar-perdida' }

export function acaoAoFechar(
  tipoDaEtapa: 'normal' | 'ganho' | 'perdido',
  finalidade: Finalidade,
): AcaoDeFechamento | null {
  if (tipoDaEtapa === 'normal') return null

  if (finalidade === 'comercial') {
    return tipoDaEtapa === 'ganho' ? { tipo: 'registrar-venda' } : { tipo: 'marcar-perdida' }
  }

  // Operacional: o desfecho positivo conclui, e o negativo cancela — sem
  // emprestar o vocabulário comercial a quem não vende.
  return tipoDaEtapa === 'ganho' ? { tipo: 'concluir' } : { tipo: 'cancelar' }
}

/**
 * A situação legada `ganha` lida hoje, sabendo a finalidade do processo.
 *
 * Compatibilidade de leitura (RB-32): o banco tem milhares de cartões `ganha`
 * escritos antes de existir finalidade. Em processo operacional, eles são
 * conclusões — não viram venda nem somem. Em comercial, ficam **pendentes de
 * classificação** até um gestor confirmar, porque "valor positivo isolado não é
 * prova".
 */
export type LeituraDoLegado = 'conclusao' | 'venda-pendente-de-revisao'

export function comoLerGanhoLegado(finalidade: Finalidade): LeituraDoLegado {
  return finalidade === 'comercial' ? 'venda-pendente-de-revisao' : 'conclusao'
}
