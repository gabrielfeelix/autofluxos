import { escolherAtendente, type Candidato, type ModoDeEscolha } from './rodizio'

/**
 * O que fazer com o dono de uma conversa quando ela pede gente.
 *
 * ---------------------------------------------------------------------------
 * O setor manda, e a carteira só ganha dentro dele
 * ---------------------------------------------------------------------------
 *
 * Sem setor, nada muda: quem já tem dono fica com ele (a carteira) e quem não
 * tem entra no rodízio da conta inteira.
 *
 * Com setor, a conversa espera alguém **daquele** setor. O dono continua com
 * ela só se for membro do setor; se não for, o rodízio escolhe entre os
 * membros, e sem ninguém apto a conversa fica sem dono na fila do setor.
 * Decisão do Gabriel em 29/out/2026: o vendedor que atendeu o cliente ano
 * passado não pode segurar o pedido de segundo boleto que é do Financeiro.
 *
 * ---------------------------------------------------------------------------
 * Estar no setor é declarar que atende
 * ---------------------------------------------------------------------------
 *
 * Fora de setor, dono e administrador ficam fora do rodízio por padrão
 * (`entraPorPadrao`). Dentro dele, ter sido posto na equipe é a declaração:
 * na empresa pequena o dono é o Financeiro inteiro, e o padrão do papel
 * deixaria a fila dele sem ninguém para sempre. Quem a conta configurou
 * explicitamente fora do rodízio continua fora.
 */

export type DecisaoDeDistribuicao =
  /** Fica como está: com o dono, ou sem dono porque ninguém pode receber. */
  | { tipo: 'manter' }
  | { tipo: 'atribuir'; usuarioId: string }
  /** O dono está fora do setor e ninguém do setor pode receber agora. */
  | { tipo: 'soltar' }

export function decidirDistribuicao(entrada: {
  dono: string | null
  /** Quem é do setor pedido, ou `null` quando a conversa não tem setor. */
  membrosDoSetor: ReadonlySet<string> | null
  /** Vazio quando a conta distribui à mão. */
  candidatos: Candidato[]
  modo: ModoDeEscolha
}): DecisaoDeDistribuicao {
  const { dono, membrosDoSetor, candidatos, modo } = entrada

  if (membrosDoSetor === null) {
    if (dono !== null) return { tipo: 'manter' }
    const escolhido = escolherAtendente(candidatos, modo)
    return escolhido ? { tipo: 'atribuir', usuarioId: escolhido } : { tipo: 'manter' }
  }

  if (dono !== null && membrosDoSetor.has(dono)) return { tipo: 'manter' }

  const doSetor = candidatos
    .filter((c) => membrosDoSetor.has(c.usuarioId))
    .map((c) => ({ ...c, entraNoRodizio: c.entraNoRodizio ?? true }))
  const escolhido = escolherAtendente(doSetor, modo)
  if (escolhido) return { tipo: 'atribuir', usuarioId: escolhido }
  return dono !== null ? { tipo: 'soltar' } : { tipo: 'manter' }
}
