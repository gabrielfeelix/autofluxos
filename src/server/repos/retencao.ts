import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Apagar contato e política de retenção.
 *
 * **Por que isto não é uma migration com `pg_cron`.** O plano original pedia
 * uma tarefa agendada no Postgres, e `pg_cron` é extensão — extensão é global
 * ao projeto, e o projeto é compartilhado com a Verandi. Ligar uma extensão
 * para uma limpeza de doze em doze meses obrigaria a avaliar o outro produto e
 * a pedir autorização de produção por causa de algo que a aplicação faz
 * sozinha. O agendamento fica na Vercel e a regra fica aqui, em código testável.
 *
 * **Apagar é apagar.** `contacts` cascateia sessões, mensagens, handoffs e a
 * trava da conversa (ver 0003 e 0007). Não existe cópia do histórico em outro
 * lugar, e é isso que a tela precisa dizer antes de perguntar se pode.
 */

/** O padrão inicial combinado no plano mestre. Um ano de conversa guardada. */
export const MESES_DE_RETENCAO_PADRAO = 12

/** Teto por execução: uma limpeza não pode virar uma transação de horas. */
export const TETO_POR_LIMPEZA = 500

/**
 * A data-limite: contato sem sinal de vida antes dela está vencido.
 *
 * Recebe o instante em vez de chamar `Date.now()` porque a fronteira do prazo é
 * o que precisa de teste, e teste que depende do relógio da máquina não prova
 * fronteira nenhuma.
 */
export function limiteDaRetencao(meses: number, agora: Date): Date {
  const limite = new Date(agora)
  limite.setUTCMonth(limite.getUTCMonth() - meses)
  return limite
}

/**
 * Apaga um contato do cliente.
 *
 * O par `(contato, cliente)` no filtro é o mesmo cuidado das outras escritas: a
 * URL é adivinhável, e apagar pelo id sozinho apagaria o contato de outro
 * cliente para quem digitasse o id certo.
 *
 * Devolve `false` quando não havia o que apagar — quem chamou precisa saber a
 * diferença entre "apaguei" e "não era seu".
 */
export async function apagarContato(clienteId: string, contatoId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('contacts')
    .delete()
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o contato: ${error.message}`)
  return data !== null
}

/**
 * Apaga vários contatos deste cliente de uma vez.
 *
 * O `client_id` no `delete` é o que faz um id de outra conta na lista não
 * apagar nada em vez de apagar o contato de outro cliente — e é por isso que a
 * resposta é "quantos foram", e não "ok": a diferença entre pedido e feito é
 * exatamente a informação de que alguém mandou id que não era dele.
 */
export async function apagarContatos(
  clienteId: string,
  contatos: string[],
): Promise<number> {
  if (contatos.length === 0) return 0

  const { data, error } = await db()
    .from('contacts')
    .delete()
    .eq('client_id', clienteId)
    .in('id', contatos)
    .select('id')

  if (ehIdInvalido(error)) return 0
  if (error) throw new Error(`não deu para apagar os contatos: ${error.message}`)
  return data?.length ?? 0
}

export type ResultadoDaLimpeza = {
  apagados: number
  /** `true` quando bateu no teto e ainda havia fila — a próxima passada segue. */
  temMais: boolean
}

/**
 * Apaga quem passou do prazo de retenção.
 *
 * O prazo conta do **último sinal de vida**: a última mensagem, ou a criação do
 * contato quando ele nunca falou. Contar só pela criação apagaria conversa
 * ativa que começou há treze meses, e isso é perder cliente, não cumprir LGPD.
 *
 * Sem `clienteId`, varre todos — é assim que a tarefa agendada chama.
 */
export async function apagarContatosVencidos(opcoes: {
  agora: Date
  meses?: number
  clienteId?: string
  teto?: number
}): Promise<ResultadoDaLimpeza> {
  const meses = opcoes.meses ?? MESES_DE_RETENCAO_PADRAO
  const teto = opcoes.teto ?? TETO_POR_LIMPEZA
  const limite = limiteDaRetencao(meses, opcoes.agora).toISOString()

  let consulta = db()
    .from('leads')
    .select('contact_id')
    // Vencido é quem não falou depois do limite. Quem nunca falou é julgado
    // pela data em que entrou. As datas são nossas, não vêm de fora.
    .or(`ultima_em.lt.${limite},and(ultima_em.is.null,criado_em.lt.${limite})`)
    .limit(teto + 1)

  if (opcoes.clienteId) consulta = consulta.eq('client_id', opcoes.clienteId)

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return { apagados: 0, temMais: false }
  if (error) throw new Error(`não deu para achar os contatos vencidos: ${error.message}`)

  const encontrados = (data as { contact_id: string }[]).map((linha) => linha.contact_id)
  const alvos = encontrados.slice(0, teto)
  if (alvos.length === 0) return { apagados: 0, temMais: false }

  const { data: apagados, error: erroAoApagar } = await db()
    .from('contacts')
    .delete()
    .in('id', alvos)
    .select('id')

  if (erroAoApagar) throw new Error(`não deu para apagar os vencidos: ${erroAoApagar.message}`)

  return {
    apagados: (apagados as { id: string }[]).length,
    temMais: encontrados.length > teto,
  }
}
