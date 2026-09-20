import 'server-only'
import {
  conferirTitulo,
  type Atividade,
  type DestinoAoFechar,
  type SituacaoDaAtividade,
  type TipoDeAtividade,
} from '@/core/atividades'
import type { FiltroDeEscopo } from '@/core/permissoes'
import { db, ehIdInvalido } from '../db'

/**
 * A agenda humana no banco (0081).
 *
 * Como todo `repos/`: só ida ao banco, sem regra. Quem decide o que é vencida
 * e o que é a próxima ação é `core/atividades.ts`.
 *
 * **Nada aqui envia nada** (RB-33). Não há função que produza mensagem, nem
 * escrita em `mensagens_agendadas`, nem em `contacts.adiada_ate`. Uma
 * atividade não vira envio porque não existe caminho que a envie.
 */

type LinhaDaAtividade = {
  id: string
  contact_id: string
  cartao_id: string | null
  tipo: string
  titulo: string
  nota: string | null
  onde: string | null
  hora_marcada: boolean | null
  prazo: string | null
  responsavel: string | null
  situacao: string
  concluida_em: string | null
  motivo_do_cancelamento: string | null
  criado_em: string
  af_usuarios: { nome: string | null } | null
}

const COLUNAS =
  'id, contact_id, cartao_id, tipo, titulo, nota, onde, hora_marcada, prazo, responsavel, situacao, ' +
  'concluida_em, motivo_do_cancelamento, criado_em, af_usuarios (nome:name)'

function paraAtividade(linha: LinhaDaAtividade): Atividade {
  return {
    id: linha.id,
    contatoId: linha.contact_id,
    cartaoId: linha.cartao_id,
    tipo: (linha.tipo as TipoDeAtividade) ?? 'tarefa',
    titulo: linha.titulo,
    nota: linha.nota,
    onde: linha.onde ?? null,
    horaMarcada: Boolean(linha.hora_marcada),
    prazo: linha.prazo,
    responsavelId: linha.responsavel,
    responsavelNome: linha.af_usuarios?.nome ?? null,
    situacao: (linha.situacao as SituacaoDaAtividade) ?? 'aberta',
    concluidaEm: linha.concluida_em,
    motivoDoCancelamento: linha.motivo_do_cancelamento,
    criadoEm: linha.criado_em,
  }
}

export type ResultadoDaAtividade =
  | { ok: true; atividade: Atividade }
  | { ok: false; motivo: string }

export type PedidoDeAtividade = {
  clienteId: string
  contatoId: string
  cartaoId?: string | null
  tipo: TipoDeAtividade
  titulo: string
  nota?: string | null
  onde?: string | null
  horaMarcada?: boolean
  prazo?: string | null
  responsavelId?: string | null
  criadaPor?: string | null
}

/**
 * Cria a atividade.
 *
 * **Não agenda mensagem nenhuma.** Vale repetir aqui porque é onde alguém
 * seria tentado a acrescentar um `if (avisarCliente)`: o aviso ao cliente é
 * outra ação, com outra permissão e outra tabela.
 */
export async function criarAtividade(pedido: PedidoDeAtividade): Promise<ResultadoDaAtividade> {
  const conferido = conferirTitulo(pedido.titulo)
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db()
    .from('atividades')
    .insert({
      client_id: pedido.clienteId,
      contact_id: pedido.contatoId,
      cartao_id: pedido.cartaoId ?? null,
      tipo: pedido.tipo,
      titulo: conferido.titulo,
      nota: pedido.nota?.trim() || null,
      onde: pedido.onde?.trim() || null,
      hora_marcada: pedido.horaMarcada ?? false,
      prazo: pedido.prazo ?? null,
      responsavel: pedido.responsavelId ?? null,
      criada_por: pedido.criadaPor ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) return { ok: false, motivo: `não deu para criar a atividade: ${error.message}` }
  return { ok: true, atividade: paraAtividade(data as unknown as LinhaDaAtividade) }
}

/** As atividades de um contato, abertas primeiro. */
export async function atividadesDoContato(
  clienteId: string,
  contatoId: string,
): Promise<Atividade[]> {
  const { data, error } = await db()
    .from('atividades')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .order('situacao', { ascending: true })
    .order('prazo', { ascending: true, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as atividades: ${error.message}`)
  return (data as unknown as LinhaDaAtividade[]).map(paraAtividade)
}

/** As atividades **abertas** de uma oportunidade. É o que a RB-28 mostra ao fechar. */
export async function abertasDoCartao(clienteId: string, cartaoId: string): Promise<Atividade[]> {
  const { data, error } = await db()
    .from('atividades')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('situacao', 'aberta')
    .order('prazo', { ascending: true, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as atividades: ${error.message}`)
  return (data as unknown as LinhaDaAtividade[]).map(paraAtividade)
}

/**
 * A agenda da conta, respeitando o escopo de quem olha.
 *
 * O filtro entra **na consulta**, e não depois: filtrar em memória entregaria
 * a agenda inteira ao processo que não devia tê-la, e contaria errado qualquer
 * total. É o mesmo motivo de `oportunidadesAbertasDoContato`.
 */
export async function agenda(
  clienteId: string,
  filtro: FiltroDeEscopo,
  opcoes: { situacao?: SituacaoDaAtividade; limite?: number } = {},
): Promise<Atividade[]> {
  if (filtro.tipo === 'impossivel') return []

  let consulta = db()
    .from('atividades')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('situacao', opcoes.situacao ?? 'aberta')

  if (filtro.tipo === 'proprios') {
    consulta = consulta.eq('responsavel', filtro.usuarioId)
  } else if (filtro.tipo === 'equipes') {
    const { data: membros, error } = await db()
      .from('equipe_membros')
      .select('usuario_id')
      .eq('client_id', clienteId)
      .in('equipe_id', [...filtro.equipes])

    if (error) throw new Error(`não deu para ler as equipes: ${error.message}`)
    const usuarios = [...new Set((membros as { usuario_id: string }[]).map((m) => m.usuario_id))]
    if (usuarios.length === 0) return []
    consulta = consulta.in('responsavel', usuarios)
  }

  const { data, error } = await consulta
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(opcoes.limite ?? 200)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler a agenda: ${error.message}`)
  return (data as unknown as LinhaDaAtividade[]).map(paraAtividade)
}

/**
 * Conclui ou cancela.
 *
 * Cancelar **exige motivo** (RB-28): uma agenda cheia de canceladas sem
 * explicação não responde a pergunta que alguém faz depois, que é sempre "por
 * que isto não foi feito".
 */
export async function resolverAtividade(
  clienteId: string,
  atividadeId: string,
  situacao: 'concluida' | 'cancelada',
  motivo?: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = (motivo ?? '').trim()
  if (situacao === 'cancelada' && limpo === '') {
    return { ok: false, motivo: 'diga por que a atividade está sendo cancelada' }
  }

  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao,
      concluida_em: agora,
      motivo_do_cancelamento: situacao === 'cancelada' ? limpo : null,
      atualizado_em: agora,
    })
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    // Só resolve o que está aberto: o duplo clique não reescreve a data de
    // conclusão de ontem.
    .eq('situacao', 'aberta')
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'essa atividade não existe' }
  if (error) throw new Error(`não deu para resolver a atividade: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'essa atividade já foi resolvida' }
}

/** Reabre uma atividade resolvida por engano. */
export async function reabrirAtividade(
  clienteId: string,
  atividadeId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao: 'aberta',
      concluida_em: null,
      motivo_do_cancelamento: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('client_id', clienteId)
    .eq('id', atividadeId)
    .neq('situacao', 'aberta')
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'essa atividade não existe' }
  if (error) throw new Error(`não deu para reabrir: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'essa atividade já está aberta' }
}

/**
 * O que fazer com as atividades abertas ao fechar a oportunidade (RB-28).
 *
 * `manter` não escreve nada, e é o ponto: elas continuam na agenda. A visita
 * marcada para a semana que vem continua marcada depois da venda fechada, e
 * concluí-la sozinha inventaria trabalho que ninguém fez.
 */
export async function resolverAoFechar(
  clienteId: string,
  cartaoId: string,
  destino: DestinoAoFechar,
  motivo?: string | null,
): Promise<{ resolvidas: number }> {
  if (destino === 'manter') return { resolvidas: 0 }

  const agora = new Date().toISOString()
  const { data, error } = await db()
    .from('atividades')
    .update({
      situacao: destino === 'concluir' ? 'concluida' : 'cancelada',
      concluida_em: agora,
      motivo_do_cancelamento:
        destino === 'cancelar' ? (motivo ?? '').trim() || 'oportunidade fechada' : null,
      atualizado_em: agora,
    })
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('situacao', 'aberta')
    .select('id')

  if (error) throw new Error(`não deu para resolver as atividades: ${error.message}`)
  return { resolvidas: (data as { id: string }[]).length }
}
