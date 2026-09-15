/**
 * Uma conexão está de pé, ou precisa de alguém?
 *
 * Puro de propósito, pelo mesmo motivo de `coexistencia-na-tela.ts`: a pergunta
 * "isto ainda funciona?" é regra de produto, e testá-la por página renderizada
 * esconderia qual caso quebrou.
 *
 * ---------------------------------------------------------------------------
 * Por que isto existe
 * ---------------------------------------------------------------------------
 *
 * **Conexão de canal cai calada.** O token do Instagram vence em 60 dias, e o
 * WhatsApp é desembarcado pela Meta quando o cliente troca de celular ou
 * reinstala o app. Nos dois casos nada explode: as mensagens simplesmente param
 * de chegar, e o primeiro a perceber é quem abre o Inbox e acha o dia vazio —
 * às vezes dias depois.
 *
 * Um único lugar decidindo isso é o que permite dizer a mesma coisa em dois
 * lugares diferentes sem que eles divirjam: o índice de Configurações, que
 * responde "o que está ligado", e o Inbox, que é onde a falta dói.
 *
 * O desenho está em `docs/PLANO-CONFIGURACOES.md` §1.3 e §1.4.
 */

export type SaudeDaConexao =
  /** Nunca foi conectada. Não é problema — é uma escolha que ninguém fez. */
  | 'nao-ligada'
  /** De pé. */
  | 'ligada'
  /** De pé, mas o token vence em poucos dias. Dá para resolver sem pressa. */
  | 'vencendo'
  /** Caiu: token vencido, permissão revogada, número desembarcado. */
  | 'reconectar'

/**
 * Com quantos dias de antecedência avisar que um token vai vencer.
 *
 * **Sete, e o número é escolhido.** O token do Instagram dura 60 dias e é
 * renovado sozinho (`canaisDoInstagramQueVencemAte`); o aviso só aparece quando a
 * renovação automática já falhou algumas vezes, e aí uma semana é o que separa
 * "dá para resolver na segunda" de "o canal caiu no fim de semana".
 *
 * Avisar cedo demais tem custo real: um selo de alerta que fica meses aceso
 * ensina a pessoa a não olhar mais para ele — o mesmo defeito do aviso de
 * importação que não saía nunca.
 */
export const AVISO_DE_VENCIMENTO_DIAS = 7

/**
 * A saúde de uma conexão que só depende da validade do token.
 *
 * `null` em `expiraEm` significa "não sabemos quando vence", e a resposta é
 * `ligada` — não `reconectar`. Chutar defeito a partir de ausência de dado
 * mandaria a pessoa reconectar um canal que está funcionando, que é o erro mais
 * caro possível aqui: reconectar o WhatsApp derruba o atendimento por minutos.
 */
export function saudePorValidade(
  expiraEm: string | null | undefined,
  agora: Date = new Date(),
): SaudeDaConexao {
  if (!expiraEm) return 'ligada'

  const restante = new Date(expiraEm).getTime() - agora.getTime()
  if (Number.isNaN(restante)) return 'ligada'
  if (restante <= 0) return 'reconectar'
  if (restante <= AVISO_DE_VENCIMENTO_DIAS * 24 * 60 * 60 * 1_000) return 'vencendo'
  return 'ligada'
}

/**
 * A saúde do WhatsApp de um cliente — que pode ter mais de um número.
 *
 * **Um número caído derruba o selo, mesmo que os outros estejam bem.** O selo
 * responde "posso confiar no WhatsApp desta conta?", e a resposta com um número
 * fora do ar é não: os leads que falavam com aquele número não estão falando
 * com nenhum outro.
 */
export function saudeDoWhatsApp(
  canais: { desembarcadoEm?: string | null }[],
): SaudeDaConexao {
  if (canais.length === 0) return 'nao-ligada'
  return canais.some((canal) => canal.desembarcadoEm) ? 'reconectar' : 'ligada'
}

/** A saúde da conta de Instagram — no máximo uma por cliente, hoje. */
export function saudeDoInstagram(
  conta: { tokenExpiraEm?: string | null } | null | undefined,
  agora: Date = new Date(),
): SaudeDaConexao {
  if (!conta) return 'nao-ligada'
  return saudePorValidade(conta.tokenExpiraEm, agora)
}

/** Precisa de alguém agora? É o que decide se o Inbox mostra faixa. */
export function pedeAcao(saude: SaudeDaConexao): boolean {
  return saude === 'reconectar'
}
