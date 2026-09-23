'use server'

import { revalidatePath } from 'next/cache'
import {
  ehDestinoAoFechar,
  ehTipoDeAtividade,
  prazoDoDia,
  type Atividade,
} from '@/core/atividades'
import {
  atividadesDoContato,
  atribuirAtividade,
  criarAtividade,
  donoDaAtividade,
  ehMembroDaConta,
  reagendarAtividade,
  reabrirAtividade,
  resolverAoFechar,
  resolverAtividade,
} from './repos/atividades'
import { contatoEhDoCliente } from './repos/crm'
import { paginarLeads } from './repos/leads'
import { oportunidadesAbertasDoContato } from './repos/quadros'
import { telefoneLegivel } from '@/core/contatos/telefone'
import type { FiltroDeEscopo } from '@/core/permissoes'
import { exigirCapacidade, filtroDoAcesso, recusou } from './permissoes'
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
    /** Link da reunião, endereço da visita, telefone da ligação. */
    onde?: string
    /** `YYYY-MM-DD` ou vazio. Vazio é "algum dia", e é escolha legítima. */
    prazo?: string
    /** `HH:MM`, quando o tipo pede hora. Vazio = só o dia. */
    hora?: string
    responsavelId?: string | null
  },
): Promise<RespostaDaAtividade & { criada?: { id: string; prazo: string | null } }> {
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
  const escopo = filtroDoAcesso(acesso, 'criar_oportunidade')

  // Responsável escolhido na tela: as mesmas regras de atribuir.
  const pedido = (dados.responsavelId ?? '').trim()
  if (pedido !== '' && pedido !== quem?.usuario.id) {
    if (escopo.tipo === 'proprios') return { ok: false, erro: 'você só pode criar atividades para você mesmo' }
    if (!(await ehMembroDaConta(clienteId, pedido))) {
      return { ok: false, erro: 'essa pessoa não é da equipe desta conta' }
    }
  }

  // O negócio precisa ser deste contato e visível para quem cria: sem isso, um
  // id de cartão de outra conta ou de outra equipe prenderia a atividade nele.
  const cartaoId = (dados.cartaoId ?? '').trim() || null
  if (cartaoId !== null) {
    const abertos = await oportunidadesAbertasDoContato(clienteId, dados.contatoId, escopo)
    if (!abertos.some((o) => o.cartaoId === cartaoId)) return { ok: false, erro: 'esse negócio não está aberto' }
  }

  const r = await criarAtividade({
    clienteId,
    contatoId: dados.contatoId,
    cartaoId,
    tipo: dados.tipo,
    titulo: dados.titulo,
    nota: dados.nota ?? null,
    onde: dados.onde ?? null,
    horaMarcada: (dados.hora ?? '').trim() !== '',
    prazo: prazoDoDia(dados.prazo, dados.hora),
    responsavelId: pedido || quem?.usuario.id || null,
    criadaPor: quem?.usuario.nome ?? null,
  })

  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, dados.contatoId)
  return { ok: true, criada: { id: r.atividade.id, prazo: r.atividade.prazo } }
}

export type ContatoParaAtividade = { contatoId: string; nome: string; telefone: string }

/**
 * Contatos para o seletor de "Nova atividade" da agenda.
 *
 * A mesma busca de Contatos (`paginarLeads`, nome ou telefone, com `estado:
 * 'todas'`), cortada em 8: é um seletor, não uma lista. Menos de 2 letras não
 * busca, porque "a" devolveria a base inteira em ordem nenhuma.
 */
export async function acaoBuscarContatosParaAtividade(
  clienteId: string,
  termo: string,
): Promise<{ ok: boolean; erro?: string; contatos?: ContatoParaAtividade[] }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const limpo = String(termo ?? '').trim()
  if (limpo.length < 2) return { ok: true, contatos: [] }

  const { leads } = await paginarLeads(clienteId, { estado: 'todas', busca: limpo, porPagina: 8 })
  return {
    ok: true,
    contatos: leads.map((l) => ({
      contatoId: l.contatoId,
      nome: l.nome || telefoneLegivel(l.waId),
      telefone: telefoneLegivel(l.waId),
    })),
  }
}

export type NegocioParaAtividade = { cartaoId: string; rotulo: string; detalhe: string }

/** Os negócios abertos do contato que quem cria pode ver, para prender a atividade. */
export async function acaoNegociosParaAtividade(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean; erro?: string; negocios?: NegocioParaAtividade[] }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso
  if (!(await contatoEhDoCliente(clienteId, contatoId))) return { ok: false, erro: 'esse contato não existe' }

  const abertos = await oportunidadesAbertasDoContato(clienteId, contatoId, filtroDoAcesso(acesso, 'criar_oportunidade'))
  return {
    ok: true,
    negocios: abertos.map((o) => ({
      cartaoId: o.cartaoId,
      rotulo: o.titulo || o.quadro,
      detalhe: `${o.quadro} · ${o.etapa}`,
    })),
  }
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

/**
 * Muda o dia (e a hora) de uma atividade aberta, pela agenda.
 *
 * O prazo sai de `prazoDoDia`, a mesma conversão da criação: duas regras de
 * dia e hora dariam duas respostas para "amanhã às 14h".
 */
export async function acaoReagendarAtividade(
  clienteId: string,
  atividadeId: string,
  /** `AAAA-MM-DD` ou vazio ("algum dia"). */
  dia: string,
  /** `HH:MM` ou vazio (só o dia). */
  hora: string,
): Promise<RespostaDaAtividade> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const escopo = filtroDoAcesso(acesso, 'criar_oportunidade')
  const dono = await conferirDono(clienteId, atividadeId, escopo)
  if (!dono.ok) return dono

  const prazo = prazoDoDia(dia, hora)
  if ((dia ?? '').trim() !== '' && prazo === null) return { ok: false, erro: 'essa data não existe' }

  const r = await reagendarAtividade(clienteId, atividadeId, {
    prazo,
    horaMarcada: prazo !== null && (hora ?? '').trim() !== '',
  })
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, dono.contatoId)
  return { ok: true }
}

/** Passa a atividade para outra pessoa da conta, ou para ninguém. */
export async function acaoAtribuirAtividade(
  clienteId: string,
  atividadeId: string,
  /** `''` = ninguém. */
  responsavelId: string,
): Promise<RespostaDaAtividade> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const escopo = filtroDoAcesso(acesso, 'criar_oportunidade')
  const dono = await conferirDono(clienteId, atividadeId, escopo)
  if (!dono.ok) return dono

  const para = responsavelId.trim() || null
  // Quem só mexe no próprio trabalho não distribui trabalho para os outros.
  if (escopo.tipo === 'proprios' && para !== escopo.usuarioId) {
    return { ok: false, erro: 'você só pode atribuir atividades a você mesmo' }
  }

  const r = await atribuirAtividade(clienteId, atividadeId, para)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId, dono.contatoId)
  return { ok: true }
}

/**
 * Com escopo `proprios`, só a atividade da própria pessoa.
 *
 * A capacidade diz *se* a pessoa mexe em atividade; o escopo diz *em qual*.
 * Sem esta conferência, o id de uma atividade do colega, colado numa chamada,
 * reagendaria o trabalho dele.
 */
async function conferirDono(
  clienteId: string,
  atividadeId: string,
  escopo: FiltroDeEscopo,
): Promise<{ ok: true; contatoId: string } | { ok: false; erro: string }> {
  const dono = await donoDaAtividade(clienteId, atividadeId)
  if (!dono) return { ok: false, erro: 'essa atividade não existe' }
  if (escopo.tipo === 'proprios' && dono.responsavelId !== escopo.usuarioId) {
    return { ok: false, erro: 'essa atividade é de outra pessoa' }
  }
  return { ok: true, contatoId: dono.contatoId }
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
  revalidatePath(`/clientes/${clienteId}/atividades`)
  revalidatePath(`/clientes/${clienteId}`, 'layout')
  if (contatoId) revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
}
