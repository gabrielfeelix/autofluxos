'use server'

import { z } from 'zod'
import { DEFINICAO_DO_CANAL, type CanalId } from '@/core/canais'
import { acaoAlternarAutomacaoDoLead } from './acoes'
import { db } from './db'
import { agendarRetomada, fimDaPausa } from './pausa-do-bot'
import { exigirCapacidade, recusou } from './permissoes'
import { enviarAutomacaoPelaEquipe } from './receber-mensagem'
import { listarFluxos } from './repos/fluxos'

const uuid = z.string().uuid()

export type AutomacaoParaEnviar = { id: string; nome: string }

/**
 * As automações que podem ser enviadas nesta conversa: publicadas, ligadas e do
 * canal dela. Site e Messenger rodam as do WhatsApp (`fluxoProprio: false`).
 *
 * Lida quando o painel abre, e não junto com a conversa: a lista só interessa
 * a quem clicou no botão, e carregar em toda conversa aberta seria uma leitura
 * a mais em cada troca de contato.
 */
export async function acaoAutomacoesParaEnviar(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: true; automacoes: AutomacaoParaEnviar[] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }
  if (!uuid.safeParse(clienteId).success || !uuid.safeParse(contatoId).success) return { ok: false, erro: 'contato inválido' }

  const { data: contato } = await db().from('contacts').select('canal').eq('id', contatoId).eq('client_id', clienteId).maybeSingle()
  if (!contato) return { ok: false, erro: 'este contato não existe neste cliente' }
  const canalDoContato = ((contato.canal as CanalId | null) ?? 'whatsapp') as CanalId
  const canalDoFluxo: CanalId = DEFINICAO_DO_CANAL[canalDoContato]?.fluxoProprio === false ? 'whatsapp' : canalDoContato

  const fluxos = await listarFluxos(clienteId)
  const automacoes = fluxos
    .filter((f) => f.versaoPublicadaId && f.ativo && f.canal === canalDoFluxo)
    .map((f) => ({ id: f.id, nome: f.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { ok: true, automacoes }
}

const MOTIVO: Record<string, string> = {
  sem_contexto: 'não foi possível abrir esta conversa agora',
  janela_fechada: 'a janela de 24 horas fechou: só um modelo aprovado pode ser enviado agora',
  automacao_pausada: 'o bot está pausado neste contato',
  sem_fluxo: 'esta automação não está publicada ou foi desligada',
  ocupado: 'a conversa está ocupada; tente de novo em instantes',
  atendimento_humano: 'esta conversa ainda aguarda uma pessoa; conclua o atendimento antes',
}

export async function acaoEnviarAutomacao(
  clienteId: string,
  contatoId: string,
  fluxoId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }
  if (![clienteId, contatoId, fluxoId].every((id) => uuid.safeParse(id).success)) return { ok: false, erro: 'dados inválidos' }

  const r = await enviarAutomacaoPelaEquipe(clienteId, contatoId, fluxoId, acesso.sessao.usuario.nome ?? null)
  return r === 'aberto' ? { ok: true } : { ok: false, erro: MOTIVO[r] ?? 'não foi possível enviar' }
}

/** Os prazos oferecidos. `null` é "até eu religar", a pausa de sempre. */
const PRAZOS = [30, 60, 240, 1440] as const

export async function acaoPausarBotPorPrazo(
  clienteId: string,
  contatoId: string,
  minutos: (typeof PRAZOS)[number] | null,
): Promise<{ ok: true; ate: string | null } | { ok: false; erro: string }> {
  if (minutos !== null && !PRAZOS.includes(minutos)) return { ok: false, erro: 'prazo inválido' }
  // A pausa em si é a de sempre (permissão, trava, sair da sequência). O prazo
  // vem depois, e só se ela deu certo.
  const pausa = await acaoAlternarAutomacaoDoLead(clienteId, contatoId, false)
  if (!pausa.ok) return { ok: false, erro: pausa.erro ?? 'não foi possível pausar' }
  await agendarRetomada(clienteId, contatoId, minutos)
  return { ok: true, ate: minutos === null ? null : new Date(Date.now() + minutos * 60_000).toISOString() }
}

export async function acaoFimDaPausa(clienteId: string, contatoId: string): Promise<string | null> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso) || !uuid.safeParse(contatoId).success) return null
  return fimDaPausa(contatoId)
}
