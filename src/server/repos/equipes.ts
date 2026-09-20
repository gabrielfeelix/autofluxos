import 'server-only'
import { ehCapacidade, ehEscopo, type Capacidade, type Escopo, type Politica } from '@/core/permissoes'
import { db, ehIdInvalido } from '../db'

/**
 * Equipes e capacidades no banco (0073).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que cada escopo alcança é
 * `core/permissoes.ts`.
 *
 * **O `client_id` em toda consulta não é zelo, é a única defesa.** A chave
 * secreta ignora RLS, então uma consulta que o esqueça não é recusada pelo
 * Postgres: ela devolve a equipe da conta do vizinho, e a permissão junto.
 */

export type Equipe = {
  id: string
  nome: string
  /** Quantas pessoas estão nela. É o que a tela mostra ao lado do nome. */
  pessoas: number
}

/** As equipes vivas de uma conta, com a contagem de gente. */
export async function listarEquipes(clienteId: string): Promise<Equipe[]> {
  const { data, error } = await db()
    .from('equipes')
    .select('id, nome, equipe_membros(count)')
    .eq('client_id', clienteId)
    .is('arquivada_em', null)
    .order('nome')

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as equipes: ${error.message}`)

  return (data as { id: string; nome: string; equipe_membros: { count: number }[] }[]).map(
    (linha) => ({
      id: linha.id,
      nome: linha.nome,
      pessoas: linha.equipe_membros[0]?.count ?? 0,
    }),
  )
}

export async function criarEquipe(
  clienteId: string,
  nome: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'dê um nome à equipe' }

  const { data, error } = await db()
    .from('equipes')
    .insert({ client_id: clienteId, nome: limpo })
    .select('id')
    .single()

  // 23505 é o índice de nome único entre as ativas: duas equipes "Vendas"
  // vivas ao mesmo tempo é erro de digitação, não intenção.
  if (error?.code === '23505') return { ok: false, motivo: `já existe uma equipe "${limpo}"` }
  if (error) return { ok: false, motivo: `não deu para criar a equipe: ${error.message}` }

  return { ok: true, id: (data as { id: string }).id }
}

/**
 * Arquiva, e não apaga.
 *
 * Há oportunidade, atividade e histórico apontando para a equipe: apagar em
 * cascata transformaria "a equipe Norte fechou isso" em "ninguém fechou isso"
 * (RB-24). Arquivada some da escolha, sai do escopo de quem estava nela, e
 * continua legível.
 */
export async function arquivarEquipe(
  clienteId: string,
  equipeId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('equipes')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', equipeId)
    .is('arquivada_em', null)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'esta equipe não existe mais' }
  if (error) return { ok: false, motivo: `não deu para arquivar: ${error.message}` }
  return data ? { ok: true } : { ok: false, motivo: 'esta equipe não existe mais' }
}

/**
 * Põe e tira gente da equipe, numa operação só.
 *
 * Recebe a lista inteira do que a pessoa deve pertencer, e não "adicione X":
 * a tela edita um conjunto, e mandar o conjunto evita o estado em que metade
 * das trocas passou. As equipes são conferidas contra a **mesma conta** antes
 * de qualquer escrita — os ids chegam de formulário.
 */
export async function definirEquipesDoMembro(
  clienteId: string,
  usuarioId: string,
  equipes: readonly string[],
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: daConta, error: erroDaConferencia } = await db()
    .from('equipes')
    .select('id')
    .eq('client_id', clienteId)
    .is('arquivada_em', null)
    .in('id', equipes.length > 0 ? equipes : ['00000000-0000-0000-0000-000000000000'])

  if (erroDaConferencia && !ehIdInvalido(erroDaConferencia)) {
    return { ok: false, motivo: `não deu para conferir as equipes: ${erroDaConferencia.message}` }
  }

  const validas = ((daConta ?? []) as { id: string }[]).map((linha) => linha.id)
  if (validas.length !== equipes.length) {
    return { ok: false, motivo: 'alguma dessas equipes não é desta conta' }
  }

  // Apaga e insere em vez de conciliar: o conjunto é pequeno (uma pessoa em
  // duas, três equipes), e conciliar daria três consultas para o mesmo fim.
  const { error: erroDoDelete } = await db()
    .from('equipe_membros')
    .delete()
    .eq('client_id', clienteId)
    .eq('usuario_id', usuarioId)

  if (erroDoDelete) return { ok: false, motivo: `não deu para atualizar: ${erroDoDelete.message}` }
  if (validas.length === 0) return { ok: true }

  const { error } = await db()
    .from('equipe_membros')
    .insert(
      validas.map((equipeId) => ({ equipe_id: equipeId, client_id: clienteId, usuario_id: usuarioId })),
    )

  if (error) return { ok: false, motivo: `não deu para atualizar: ${error.message}` }
  return { ok: true }
}

/** As equipes de cada pessoa da conta, para a tela desenhar a lista de uma vez. */
export async function equipesPorMembro(clienteId: string): Promise<Map<string, string[]>> {
  const { data, error } = await db()
    .from('equipe_membros')
    .select('usuario_id, equipe_id, equipes!inner(arquivada_em)')
    .eq('client_id', clienteId)
    .is('equipes.arquivada_em', null)

  if (error) {
    console.error('[equipes] não deu para ler os vínculos:', error.message)
    return new Map()
  }

  const saida = new Map<string, string[]>()
  for (const linha of data as { usuario_id: string; equipe_id: string }[]) {
    const atual = saida.get(linha.usuario_id) ?? []
    atual.push(linha.equipe_id)
    saida.set(linha.usuario_id, atual)
  }
  return saida
}

// ---------------------------------------------------------------------------
// As capacidades
// ---------------------------------------------------------------------------

/**
 * Grava a diferença entre o que o papel dá e o que esta pessoa tem.
 *
 * **Escopo igual ao do papel vira ausência de linha**, e isso é deliberado: a
 * sobrescrita existe para registrar a exceção, e gravar o que já é regra faria
 * a tabela crescer com linhas que não dizem nada — e congelaria a pessoa na
 * política de hoje, para sempre, sem ninguém pedir isso. Mudar o papel dela
 * depois não teria efeito.
 */
export async function definirCapacidades(
  clienteId: string,
  usuarioId: string,
  desejado: Partial<Politica>,
  doPapel: Politica,
  autor: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const diferentes: { capacidade: Capacidade; escopo: Escopo }[] = []
  const iguais: Capacidade[] = []

  for (const [chave, escopo] of Object.entries(desejado)) {
    if (!ehCapacidade(chave) || escopo === undefined || !ehEscopo(escopo)) continue
    if (escopo === doPapel[chave]) iguais.push(chave)
    else diferentes.push({ capacidade: chave, escopo })
  }

  if (iguais.length > 0) {
    const { error } = await db()
      .from('membro_capacidades')
      .delete()
      .eq('client_id', clienteId)
      .eq('usuario_id', usuarioId)
      .in('capacidade', iguais)
    if (error) return { ok: false, motivo: `não deu para salvar: ${error.message}` }
  }

  if (diferentes.length > 0) {
    const { error } = await db()
      .from('membro_capacidades')
      .upsert(
        diferentes.map(({ capacidade, escopo }) => ({
          client_id: clienteId,
          usuario_id: usuarioId,
          capacidade,
          escopo,
          autor,
          atualizado_em: new Date().toISOString(),
        })),
        { onConflict: 'client_id,usuario_id,capacidade' },
      )
    if (error) return { ok: false, motivo: `não deu para salvar: ${error.message}` }
  }

  return { ok: true }
}

/** As sobrescritas de cada pessoa da conta, para a tela desenhar de uma vez. */
export async function capacidadesPorMembro(
  clienteId: string,
): Promise<Map<string, Partial<Politica>>> {
  const { data, error } = await db()
    .from('membro_capacidades')
    .select('usuario_id, capacidade, escopo')
    .eq('client_id', clienteId)

  if (error) {
    console.error('[equipes] não deu para ler as capacidades:', error.message)
    return new Map()
  }

  const saida = new Map<string, Partial<Politica>>()
  for (const linha of data as { usuario_id: string; capacidade: string; escopo: string }[]) {
    if (!ehCapacidade(linha.capacidade) || !ehEscopo(linha.escopo)) continue
    const atual = saida.get(linha.usuario_id) ?? {}
    atual[linha.capacidade] = linha.escopo
    saida.set(linha.usuario_id, atual)
  }
  return saida
}

/**
 * O que sobra quando alguém sai da equipe.
 *
 * A RB-40 manda decidir o destino das atribuições e atividades abertas, e
 * **nunca deixar referências sem tratamento**. Esta função só conta: quem
 * decide o destino é a tela, e a reassociação é explícita (T5.3 entrega a
 * agenda; aqui já é possível dizer quantas conversas ficariam órfãs).
 */
export async function pendenciasDoMembro(
  clienteId: string,
  usuarioId: string,
): Promise<{ conversas: number; cartoes: number }> {
  const [conversas, cartoes] = await Promise.all([
    db()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('atribuido_a', usuarioId),
    db()
      .from('quadro_cartoes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('responsavel', usuarioId)
      .eq('situacao', 'aberta'),
  ])

  return { conversas: conversas.count ?? 0, cartoes: cartoes.count ?? 0 }
}
