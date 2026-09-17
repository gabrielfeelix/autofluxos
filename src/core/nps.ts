/**
 * O NPS: a conta que transforma notas soltas numa resposta.
 *
 * Puro, e pelo mesmo motivo de `core/horario.ts`: é aritmética sobre dado, e
 * aritmética tem que dar para testar sem subir servidor nem ter banco.
 *
 * A faixa de cada nota vem de `flow/schema.ts` (`faixaDaNota`), que é a mesma
 * que o motor usa para escolher a saída do bloco. Duas réguas para a mesma
 * pergunta é como o relatório passa a discordar do fluxo que o cliente desenhou.
 */

import { faixaDaNota } from './flow/schema'

export type NotaLida = {
  nota: number
  criadaEm: string
}

export type ResumoDoNps = {
  /**
   * Promotores menos detratores, em pontos, de -100 a 100.
   *
   * **Neutros contam no total e não no cálculo**, que é a definição do NPS e
   * também a parte que mais confunde quem vê o número pela primeira vez: dez
   * notas 8 dão zero, e zero aqui não quer dizer "ninguém respondeu".
   */
  pontos: number
  promotores: number
  neutros: number
  detratores: number
  total: number
  /** A média simples das notas, que é a pergunta que todo mundo faz junto. */
  media: number
}

export const NPS_VAZIO: ResumoDoNps = {
  pontos: 0,
  promotores: 0,
  neutros: 0,
  detratores: 0,
  total: 0,
  media: 0,
}

export function resumirNps(notas: NotaLida[]): ResumoDoNps {
  if (notas.length === 0) return NPS_VAZIO

  let promotores = 0
  let neutros = 0
  let detratores = 0
  let soma = 0

  for (const { nota } of notas) {
    soma += nota
    const faixa = faixaDaNota(nota)
    if (faixa === 'promotor') promotores += 1
    else if (faixa === 'neutro') neutros += 1
    else detratores += 1
  }

  const total = notas.length

  return {
    /*
     * Arredondado para inteiro porque é assim que o NPS se lê e se compara.
     * "72,4" sugere uma precisão que trinta respostas não têm.
     */
    pontos: Math.round(((promotores - detratores) / total) * 100),
    promotores,
    neutros,
    detratores,
    total,
    media: Math.round((soma / total) * 10) / 10,
  }
}

/**
 * Como se lê o número, em uma palavra.
 *
 * Existe porque `-100 a 100` não diz nada para quem abre o painel pela primeira
 * vez, e a régua pública do NPS (crítico, aperfeiçoamento, qualidade, excelência)
 * é a que o cliente vai encontrar se procurar fora.
 */
export function comoVai(pontos: number): 'crítico' | 'razoável' | 'bom' | 'excelente' {
  if (pontos < 0) return 'crítico'
  if (pontos < 50) return 'razoável'
  if (pontos < 75) return 'bom'
  return 'excelente'
}
