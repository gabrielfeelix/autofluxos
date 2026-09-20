'use server'

import { revalidatePath } from 'next/cache'
import {
  ehDestinoAoFechar,
  ehTipoDeAtividade,
  type Atividade,
} from '@/core/atividades'
import {
  atividadesDoContato,
  criarAtividade,
  reabrirAtividade,
  resolverAoFechar,
  resolverAtividade,
} from './repos/atividades'
import { contatoEhDoCliente } from './repos/crm'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações da agenda humana (T5.3).
 *
 * **Nenhuma delas envia nada** (RB-33). Não há aqui escrita em
 * `mensagens_agendadas` nem em `contacts.adiada_ate`, e a ausência é o ponto:
 * "lembrar de entrar em contato" e "agendar mensagem" são duas ações
 * diferentes, com permissões diferentes, e quem quiser a segunda usa
 * `acoes-agendadas.ts`.
 *
 * A capacidade é `criar_oportunidade`, que a lista de `core/permissoes.ts`
 * descreve como "criar oportunidade e atividade". Não é `atender`, porque
 * marcar tarefa para outra pessoa é ato de operação; e não é
 * `configurar_operacao`, que trancaria o vendedor para fora da própria agenda.
 */

export type RespostaDaAtividade = { ok: boolean; erro?: string }

export async function acaoCriarAtividade(
  clienteId: string,
  dados: {
    contatoId: string
    cartaoId?: string | null
    tipo: string
    titulo: string
    nota?: string
    /** `YYYY-MM-DD` ou vazio. Vazio é "algum dia", e é escolha legítima. */
    prazo?: string
    responsavelId?: string | null
  },
): Promise<RespostaDaAtividade> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  if (!ehTipoDeAtividade(dados.tipo)) return { ok: false, erro: 'esse tipo não existe' }

  // O contato vem da tela, e a FK garante que ele existe, não de quem ele é.
  // `service_role` ignora RLS: sem esta conferência, um id de outra conta
  // criaria atividade na agenda do vizinho.
  if (!(await contatoEhDoCliente(clienteId, dados.contatoId))) {
    return { ok: false, erro: 'esse contato não existe' }
  }

  const quem = await sessaoAtual()
  const r = await criarAtividade({
    clienteId,
    contatoId: dados.contatoId,
    cartaoId: dados.cartaoId ?? null,
    tipo: dados.tipo,
    titulo: dados.titulo,
    nota: dados.nota ?? null,
    prazo: prazoDoDia(dados.prazo),
    responsavelId: dados.responsavelId ?? quem?.usuario.id ?? null,
    criadaPor: quem?.usuario.nome ?? null,
  })

  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, dados.contatoId)
  return { ok: true }
}

/**
 * A data da tela vira instante.
 *
 * `YYYY-MM-DD` sem hora é interpretado como meia-noite **UTC** pelo
 * `Date.parse`, e a régua de `urgenciaDe` compara por dia UTC. Mandar a data
 * crua mantém os dois lados falando a mesma língua; montar um instante local
 * aqui faria "hoje" virar "ontem" para quem está a oeste de Greenwich.
 */
function prazoDoDia(dia: string | undefined): string | null {
  const limpo = (dia ?? '').trim()
  if (limpo === '') return null
  const data = Date.parse(`${limpo}T12:00:00Z`)
  return Number.isNaN(data) ? null : new Date(data).toISOString()
}

export async function acaoResolverAtividade(
  clienteId: string,
  atividadeId: string,
  situacao: string,
  motivo?: string,
): Promise<RespostaDaAtividade> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  if (situacao !== 'concluida' && situacao !== 'cancelada') {
    return { ok: false, erro: 'essa situação não existe' }
  }

  const r = await resolverAtividade(clienteId, atividadeId, situacao, motivo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, null)
  return { ok: true }
}

export async function acaoReabrirAtividade(
  clienteId: string,
  atividadeId: string,
): Promise<RespostaDaAtividade> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const r = await reabrirAtividade(clienteId, atividadeId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, null)
  return { ok: true }
}

/**
 * O que fazer com as atividades abertas ao fechar a oportunidade (RB-28).
 *
 * Chamada **depois** do fechamento, e por escolha explícita da pessoa. Não é
 * efeito colateral do ganhar: marcar tudo como feito automaticamente
 * inventaria trabalho, e cancelar em silêncio apagaria compromisso assumido
 * com o cliente.
 */
export async function acaoResolverAtividadesAoFechar(
  clienteId: string,
  cartaoId: string,
  destino: string,
  motivo?: string,
): Promise<RespostaDaAtividade & { resolvidas?: number }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  if (!ehDestinoAoFechar(destino)) return { ok: false, erro: 'escolha o que fazer com elas' }

  const r = await resolverAoFechar(clienteId, cartaoId, destino, motivo)
  recarregar(clienteId, null)
  return { ok: true, resolvidas: r.resolvidas }
}

/** As atividades de um contato, para a ficha e o painel. */
export async function acaoLerAtividades(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: true; atividades: Atividade[] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  return { ok: true, atividades: await atividadesDoContato(clienteId, contatoId) }
}

function recarregar(clienteId: string, contatoId: string | null): void {
  revalidatePath(`/clientes/${clienteId}/quadros`)
  revalidatePath(`/clientes/${clienteId}/quadros/atividades`)
  if (contatoId) revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
}
