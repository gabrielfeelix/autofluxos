import 'server-only'
import { ENDERECO_DA_AGENDA, NOME_DA_CREDENCIAL_DA_AGENDA } from '@/core/agenda'
import type { HorarioLivre } from '@/core/formulario-de-agendamento'
import { lerCredencial, listarConexoes } from '../repos/conexoes'

/**
 * As chamadas da Verandi que o formulário faz, com a chave `vr_` que a conta
 * já ligou em Ajustes (a mesma credencial dos blocos prontos). Endereço fixo e
 * nosso, como em `server/agenda.ts`: sem conferência de SSRF.
 *
 * O WhatsApp espera a resposta do endpoint por **10 segundos**, e marcar pode
 * custar três chamadas (achar a pessoa, cadastrar, marcar). Cada uma tem 3 s.
 */

const TIMEOUT_MS = 3_000

/** A chave da agenda da conta, ou `null` se ela não ligou a Verandi. */
export async function chaveDaAgenda(clienteId: string): Promise<string | null> {
  const conexao = (await listarConexoes(clienteId)).find((c) => c.nome === NOME_DA_CREDENCIAL_DA_AGENDA)
  if (!conexao) return null
  return (await lerCredencial(conexao.id, clienteId))?.valor ?? null
}

async function chamar(chave: string, caminho: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${ENDERECO_DA_AGENDA}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${chave}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
}

export async function horariosLivres(chave: string, de: string, ate: string): Promise<HorarioLivre[]> {
  const resposta = await chamar(chave, `/disponibilidade?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
  if (!resposta.ok) throw new Error(`a agenda respondeu ${resposta.status} em /disponibilidade`)
  const corpo = (await resposta.json()) as { livres?: Partial<HorarioLivre>[] }
  return (corpo.livres ?? [])
    .filter((h): h is HorarioLivre => typeof h.sessaoId === 'string' && typeof h.data === 'string' && typeof h.hora === 'string')
    .map((h) => ({
      sessaoId: h.sessaoId,
      data: h.data,
      hora: h.hora,
      servico: h.servico ?? null,
      profissional: h.profissional ?? null,
      livres: typeof h.livres === 'number' ? h.livres : null,
    }))
}

/** A pessoa pelo telefone, cadastrada na hora se não existe. */
export async function pessoaNaAgenda(chave: string, telefone: string, nome: string): Promise<string> {
  const achada = await chamar(chave, `/pessoas?telefone=${encodeURIComponent(telefone)}`)
  if (!achada.ok) throw new Error(`a agenda respondeu ${achada.status} em /pessoas`)
  const lista = (await achada.json()) as { pessoas?: { pessoaId?: string }[] }
  const id = lista.pessoas?.[0]?.pessoaId
  if (id) return id

  const criada = await chamar(chave, '/pessoas', { method: 'POST', body: JSON.stringify({ nome, telefone }) })
  if (!criada.ok) throw new Error(`a agenda respondeu ${criada.status} ao cadastrar`)
  const corpo = (await criada.json()) as { pessoaId?: string }
  if (!corpo.pessoaId) throw new Error('a agenda cadastrou sem devolver pessoaId')
  return corpo.pessoaId
}

export type ResultadoDaMarcacao = { ok: true; participacaoId: string } | { ok: false; motivo: string }

/**
 * 409 é conversa normal, não defeito: a vaga acabou entre montar a lista e
 * tocar em Marcar, a pessoa já está marcada, o plano dela não vale no dia. A
 * frase da Verandi ("este horário está cheio") vai para a tela do formulário.
 */
export async function marcarNaAgenda(chave: string, pessoaId: string, sessaoId: string): Promise<ResultadoDaMarcacao> {
  const resposta = await chamar(chave, '/participacoes', { method: 'POST', body: JSON.stringify({ pessoaId, sessaoId }) })
  if (resposta.status === 409) {
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: unknown }
    const frase = typeof corpo.erro === 'string' && corpo.erro.trim() ? corpo.erro.trim() : 'este horário não está mais disponível'
    return { ok: false, motivo: `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.` }
  }
  if (!resposta.ok) throw new Error(`a agenda respondeu ${resposta.status} ao marcar`)
  const corpo = (await resposta.json()) as { participacaoId?: string }
  if (!corpo.participacaoId) throw new Error('a agenda marcou sem devolver participacaoId')
  return { ok: true, participacaoId: corpo.participacaoId }
}
