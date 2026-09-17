import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * A fila de mensagens marcadas para depois (`0057`).
 *
 * ---------------------------------------------------------------------------
 * Por que uma tabela e não mais um tipo em `tarefas`
 * ---------------------------------------------------------------------------
 *
 * `tarefas` é fila de máquina: linha opaca, executada e esquecida. Isto é dado
 * que a **pessoa** vê, lista, cancela e de quem cobra explicação quando falha.
 * Precisa de estado nomeado, do motivo do erro guardado e de ser contável por
 * conta. Enfiar isso num `dados jsonb` de tarefa faria a tela ler o que ninguém
 * deveria ler.
 */

export type EstadoDaAgendada = 'agendada' | 'enviando' | 'enviada' | 'cancelada' | 'falhou'

export type MensagemAgendada = {
  id: string
  clienteId: string
  contatoId: string
  texto: string
  quando: string
  criadaPorNome: string | null
  estado: EstadoDaAgendada
  enviadaEm: string | null
  erro: string | null
  /**
   * O modelo aprovado a usar quando a janela de 24h estiver fechada na hora do
   * envio (`0067`). Nulo = só texto livre, e aí o envio depende da janela.
   */
  templateId: string | null
  /** Valores das variáveis. Nulo = resolver na hora, com o nome do contato. */
  templateValores: Record<string, string[]> | null
}

/**
 * Quantas uma passada leva.
 *
 * Pequeno de propósito: isto roda de carona no webhook, **depois** de a Meta já
 * ter recebido 200, e a mensagem que acabou de chegar tem prioridade sobre a
 * que alguém marcou. Vinte cobre qualquer conta real; o que sobrar sai na
 * passada seguinte, que nunca demora porque conta com movimento recebe webhook.
 */
export const AGENDADAS_POR_PASSADA = 20

/**
 * Quanto tempo uma linha pode ficar `enviando` antes de voltar para a fila.
 *
 * Cinco minutos. `enviando` só dura o tempo de uma chamada à Cloud API; passou
 * disso, a função que a pegou morreu no meio — teto de tempo, deploy, erro de
 * rede. Devolver é o certo, e o risco assumido está escrito em `devolverPresas`.
 */
const LIMITE_DO_ENVIANDO_MS = 5 * 60 * 1000

const COLUNAS =
  'id, cliente_id, contato_id, texto, quando, criada_por_nome, estado, enviada_em, erro, template_id, template_valores'

function daLinha(linha: Record<string, unknown>): MensagemAgendada {
  return {
    id: linha.id as string,
    clienteId: linha.cliente_id as string,
    contatoId: linha.contato_id as string,
    texto: linha.texto as string,
    quando: linha.quando as string,
    criadaPorNome: (linha.criada_por_nome as string | null) ?? null,
    estado: linha.estado as EstadoDaAgendada,
    enviadaEm: (linha.enviada_em as string | null) ?? null,
    erro: (linha.erro as string | null) ?? null,
    templateId: (linha.template_id as string | null) ?? null,
    templateValores:
      (linha.template_valores as Record<string, string[]> | null) ?? null,
  }
}

export async function agendar(dados: {
  clienteId: string
  contatoId: string
  texto: string
  quando: string
  criadaPor: string | null
  criadaPorNome: string | null
  /** O modelo a usar se a janela estiver fechada na hora. Ver `0067`. */
  templateId?: string | null
}): Promise<MensagemAgendada> {
  const { data, error } = await db()
    .from('mensagens_agendadas')
    .insert({
      cliente_id: dados.clienteId,
      contato_id: dados.contatoId,
      texto: dados.texto,
      quando: dados.quando,
      criada_por: dados.criadaPor,
      criada_por_nome: dados.criadaPorNome,
      template_id: dados.templateId ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para agendar a mensagem: ${error.message}`)
  return daLinha(data as Record<string, unknown>)
}

/**
 * Cancelar.
 *
 * **Só o que ainda não saiu.** O `eq('estado', 'agendada')` não é zelo: sem ele,
 * clicar em cancelar numa linha que a passada pegou meio segundo antes marcaria
 * como cancelada uma mensagem que o cliente já recebeu — e a tela passaria a
 * mentir sobre o que foi enviado.
 *
 * Devolve `false` quando não havia mais o que cancelar, e quem chama diz isso na
 * tela em vez de fingir que deu.
 */
export async function cancelarAgendada(clienteId: string, id: string): Promise<boolean> {
  const { data, error } = await db()
    .from('mensagens_agendadas')
    .update({ estado: 'cancelada' })
    .eq('id', id)
    .eq('cliente_id', clienteId)
    .eq('estado', 'agendada')
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para cancelar a mensagem: ${error.message}`)
  return (data ?? []).length > 0
}

/** As que ainda vão sair, de um contato — é o que a ficha da conversa mostra. */
export async function agendadasDoContato(
  clienteId: string,
  contatoId: string,
): Promise<MensagemAgendada[]> {
  const { data, error } = await db()
    .from('mensagens_agendadas')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('contato_id', contatoId)
    .in('estado', ['agendada', 'enviando', 'falhou'])
    .order('quando', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as mensagens agendadas: ${error.message}`)
  return (data ?? []).map((linha) => daLinha(linha as Record<string, unknown>))
}

/**
 * Todas as da conta, com o nome do contato junto.
 *
 * É a lista que o contador da barra de filtros abre. **Conta por `cliente_id`**,
 * e não por contato: a pergunta do dono foi "quantas agendadas temos no total".
 */
export async function agendadasDaConta(
  clienteId: string,
): Promise<(MensagemAgendada & { nomeDoContato: string | null })[]> {
  const { data, error } = await db()
    .from('mensagens_agendadas')
    .select(`${COLUNAS}, contacts!inner(nome)`)
    .eq('cliente_id', clienteId)
    .in('estado', ['agendada', 'enviando', 'falhou'])
    .order('quando', { ascending: true })
    .limit(200)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as mensagens agendadas: ${error.message}`)

  return (data ?? []).map((linha) => {
    const bruta = linha as Record<string, unknown>
    const contato = bruta.contacts as { nome?: string | null } | null
    return { ...daLinha(bruta), nomeDoContato: contato?.nome ?? null }
  })
}

/**
 * Devolve para a fila o que ficou preso em `enviando`.
 *
 * **O risco está aqui e é assumido de propósito.** Se a função morreu *depois*
 * de a Meta aceitar e *antes* de marcar `enviada`, devolver manda a mesma
 * mensagem duas vezes. O outro caminho — deixar presa — é uma mensagem que
 * alguém marcou e que nunca sai, sem erro nenhum na tela. Entre repetir e
 * sumir, o mercado inteiro escolhe repetir, e é o mesmo trato que
 * `devolverDesconhecidas` faz com as tarefas.
 */
async function devolverPresas(): Promise<void> {
  const limite = new Date(Date.now() - LIMITE_DO_ENVIANDO_MS).toISOString()
  const { error } = await db()
    .from('mensagens_agendadas')
    .update({ estado: 'agendada', pegada_em: null })
    .eq('estado', 'enviando')
    .lt('pegada_em', limite)

  if (error) console.error('[agendadas] não deu para devolver as presas', error.message)
}

/**
 * Pega o que venceu, e garante que ninguém mais pegue as mesmas linhas.
 *
 * **Quem decide o dono é o próprio `update`, não uma leitura anterior.** Duas
 * passadas simultâneas — a carona do webhook e o cron, por exemplo — leriam a
 * mesma lista e mandariam a mesma mensagem duas vezes. Com o `eq('estado',
 * 'agendada')` dentro da escrita, o Postgres serializa as duas e a segunda
 * simplesmente não casa com nada: ela recebe zero linhas e vai embora.
 */
export async function pegarVencidas(limite = AGENDADAS_POR_PASSADA): Promise<MensagemAgendada[]> {
  await devolverPresas()

  const agora = new Date().toISOString()

  /*
   * A escolha das candidatas vem antes porque o PostgREST não tem `limit` em
   * `update`. Sem teto, uma conta que ficou um dia fora do ar pegaria trezentas
   * linhas de uma vez e estouraria o tempo da função — e as trezentas ficariam
   * `enviando`, esperando cinco minutos para voltar.
   *
   * Essa leitura pode sair desatualizada, e não tem problema: ela só escolhe
   * quem **tentar** pegar. Quem decide é a escrita logo abaixo.
   */
  const { data: candidatas, error: erroDaLeitura } = await db()
    .from('mensagens_agendadas')
    .select('id')
    .eq('estado', 'agendada')
    .lte('quando', agora)
    .order('quando', { ascending: true })
    .limit(limite)

  if (ehIdInvalido(erroDaLeitura)) return []
  if (erroDaLeitura) {
    throw new Error(`não deu para olhar a fila de agendadas: ${erroDaLeitura.message}`)
  }

  const ids = (candidatas ?? []).map((linha) => (linha as { id: string }).id)
  if (ids.length === 0) return []

  const { data, error } = await db()
    .from('mensagens_agendadas')
    .update({ estado: 'enviando', pegada_em: agora })
    .in('id', ids)
    .eq('estado', 'agendada')
    .select(COLUNAS)

  if (error) throw new Error(`não deu para pegar a fila de agendadas: ${error.message}`)
  return (data ?? []).map((linha) => daLinha(linha as Record<string, unknown>))
}

export async function marcarEnviada(id: string): Promise<void> {
  const { error } = await db()
    .from('mensagens_agendadas')
    .update({ estado: 'enviada', enviada_em: new Date().toISOString(), erro: null })
    .eq('id', id)

  if (error) console.error('[agendadas] não deu para marcar como enviada', id, error.message)
}

/**
 * Falhou, e o motivo fica guardado.
 *
 * **Não volta para a fila.** Quase toda falha aqui é a janela de 24h ter
 * fechado, e tentar de novo em cinco minutos vai falhar igual — três vezes, com
 * a mesma recusa. O que resolve é uma pessoa ler o motivo e decidir, e para isso
 * o erro precisa estar na tela, não numa fila que se repete sozinha.
 */
export async function marcarFalha(id: string, motivo: string): Promise<void> {
  const { error } = await db()
    .from('mensagens_agendadas')
    .update({ estado: 'falhou', erro: motivo.slice(0, 500) })
    .eq('id', id)

  if (error) console.error('[agendadas] não deu para marcar a falha', id, error.message)
}

/** Quantas ainda vão sair nesta conta — o número da barra de filtros. */
export async function quantasAgendadas(clienteId: string): Promise<number> {
  const { count, error } = await db()
    .from('mensagens_agendadas')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .in('estado', ['agendada', 'enviando', 'falhou'])

  if (ehIdInvalido(error)) return 0
  if (error) {
    console.error('[agendadas] não deu para contar', error.message)
    return 0
  }
  return count ?? 0
}
