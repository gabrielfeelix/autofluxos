import 'server-only'
import { randomBytes } from 'node:crypto'
import { base62 } from '@/core/api/chaves'
import { ehEventoDeWebhook, PREFIXO_DO_SEGREDO, type EventoDeWebhook } from '@/core/api/webhooks'
import { apagarDoCofre, guardarNoCofre } from '../cofre'
import { db, ehIdInvalido } from '../db'

/**
 * Webhooks de saída e as entregas deles (0122). Só ida ao banco e ao cofre;
 * quem envia é `server/webhooks-de-saida.ts`.
 *
 * Toda leitura e escrita leva o `client_id` junto do id: a ação recebe o id da
 * tela, e a tela é adivinhável.
 */

export type WebhookDeSaida = {
  id: string
  url: string
  eventos: EventoDeWebhook[]
  ativo: boolean
  falhasSeguidas: number
  pausadoEm: string | null
  criadoEm: string
}

export type EntregaDeWebhook = {
  id: string
  webhookId: string
  evento: string
  status: 'pendente' | 'entregue' | 'falhou'
  tentativas: number
  ultimoStatusHttp: number | null
  resposta: string | null
  proximaEm: string
  criadoEm: string
  entregueEm: string | null
}

type LinhaDoWebhook = {
  id: string
  url: string
  eventos: string[]
  ativo: boolean
  falhas_seguidas: number
  pausado_em: string | null
  criado_em: string
}

const COLUNAS = 'id, url, eventos, ativo, falhas_seguidas, pausado_em, criado_em'

function paraWebhook(linha: LinhaDoWebhook): WebhookDeSaida {
  return {
    id: linha.id,
    url: linha.url,
    eventos: linha.eventos.filter(ehEventoDeWebhook),
    ativo: linha.ativo,
    falhasSeguidas: linha.falhas_seguidas,
    pausadoEm: linha.pausado_em,
    criadoEm: linha.criado_em,
  }
}

type LinhaDaEntrega = {
  id: string
  webhook_id: string
  evento: string
  status: string
  tentativas: number
  ultimo_status_http: number | null
  resposta: string | null
  proxima_em: string
  criado_em: string
  entregue_em: string | null
}

export function paraEntrega(linha: LinhaDaEntrega): EntregaDeWebhook {
  return {
    id: linha.id,
    webhookId: linha.webhook_id,
    evento: linha.evento,
    status: linha.status === 'entregue' || linha.status === 'falhou' ? linha.status : 'pendente',
    tentativas: linha.tentativas,
    ultimoStatusHttp: linha.ultimo_status_http,
    resposta: linha.resposta,
    proximaEm: linha.proxima_em,
    criadoEm: linha.criado_em,
    entregueEm: linha.entregue_em,
  }
}

/** Tabela ainda não existe (0122 não aplicada): a tela mostra vazio em vez de cair. */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function listarWebhooks(clienteId: string): Promise<WebhookDeSaida[]> {
  const { data, error } = await db()
    .from('webhooks_de_saida')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })
  if (tabelaAusente(error) || ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os webhooks: ${error.message}`)
  return (data as LinhaDoWebhook[]).map(paraWebhook)
}

/** O segredo novo, `whsec_` mais 32 bytes em base62. Mostrado uma vez. */
function sortearSegredoDoWebhook(): string {
  return `${PREFIXO_DO_SEGREDO}${base62(randomBytes(32))}`
}

export async function criarWebhook(
  clienteId: string,
  dados: { url: string; eventos: EventoDeWebhook[]; autorId: string | null },
): Promise<{ webhook: WebhookDeSaida; segredo: string }> {
  const segredo = sortearSegredoDoWebhook()
  const segredoId = await guardarNoCofre(segredo, `webhook-de-saida:${clienteId}:${randomBytes(6).toString('hex')}`)

  const { data, error } = await db()
    .from('webhooks_de_saida')
    .insert({ client_id: clienteId, url: dados.url, eventos: dados.eventos, segredo_id: segredoId, criado_por: dados.autorId })
    .select(COLUNAS)
    .single()
  if (error) {
    await apagarDoCofre(segredoId)
    throw new Error(`não deu para criar o webhook: ${error.message}`)
  }
  return { webhook: paraWebhook(data as LinhaDoWebhook), segredo }
}

export async function editarWebhook(
  clienteId: string,
  id: string,
  dados: { url?: string; eventos?: EventoDeWebhook[]; ativo?: boolean },
): Promise<WebhookDeSaida | null> {
  const mudanca: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (dados.url !== undefined) mudanca.url = dados.url
  if (dados.eventos !== undefined) mudanca.eventos = dados.eventos
  if (dados.ativo !== undefined) {
    mudanca.ativo = dados.ativo
    // Religar é recomeçar: a contagem de falhas e a pausa automática zeram.
    if (dados.ativo) {
      mudanca.falhas_seguidas = 0
      mudanca.pausado_em = null
    }
  }

  const { data, error } = await db()
    .from('webhooks_de_saida')
    .update(mudanca)
    .eq('client_id', clienteId)
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para editar o webhook: ${error.message}`)
  return data ? paraWebhook(data as LinhaDoWebhook) : null
}

/** Troca o segredo. O antigo deixa de valer na hora. */
export async function trocarSegredoDoWebhook(clienteId: string, id: string): Promise<string | null> {
  const atual = await segredoIdDe(clienteId, id)
  if (!atual) return null
  const segredo = sortearSegredoDoWebhook()
  const novoId = await guardarNoCofre(segredo, `webhook-de-saida:${clienteId}:${randomBytes(6).toString('hex')}`)
  const { error } = await db()
    .from('webhooks_de_saida')
    .update({ segredo_id: novoId, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', id)
  if (error) {
    await apagarDoCofre(novoId)
    throw new Error(`não deu para trocar o segredo: ${error.message}`)
  }
  await apagarDoCofre(atual)
  return segredo
}

export async function apagarWebhook(clienteId: string, id: string): Promise<WebhookDeSaida | null> {
  const segredoId = await segredoIdDe(clienteId, id)
  const { data, error } = await db()
    .from('webhooks_de_saida')
    .delete()
    .eq('client_id', clienteId)
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para apagar o webhook: ${error.message}`)
  if (segredoId) await apagarDoCofre(segredoId)
  return data ? paraWebhook(data as LinhaDoWebhook) : null
}

async function segredoIdDe(clienteId: string, id: string): Promise<string | null> {
  const { data, error } = await db()
    .from('webhooks_de_saida')
    .select('segredo_id')
    .eq('client_id', clienteId)
    .eq('id', id)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o webhook: ${error.message}`)
  return (data as { segredo_id: string } | null)?.segredo_id ?? null
}

/** As últimas entregas de todos os webhooks da organização, mais novas primeiro. */
export async function ultimasEntregas(clienteId: string, limite = 30): Promise<EntregaDeWebhook[]> {
  const { data, error } = await db()
    .from('entregas_de_webhook')
    .select('id, webhook_id, evento, status, tentativas, ultimo_status_http, resposta, proxima_em, criado_em, entregue_em')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (tabelaAusente(error) || ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as entregas: ${error.message}`)
  return (data as LinhaDaEntrega[]).map(paraEntrega)
}

/** Os webhooks ativos da organização que assinam este evento, com o id do segredo. */
export async function assinantesDoEvento(
  clienteId: string,
  evento: EventoDeWebhook,
): Promise<{ id: string }[]> {
  const { data, error } = await db()
    .from('webhooks_de_saida')
    .select('id')
    .eq('client_id', clienteId)
    .eq('ativo', true)
    .contains('eventos', [evento])
  if (tabelaAusente(error)) return []
  if (error) throw new Error(`não deu para achar os assinantes: ${error.message}`)
  return data as { id: string }[]
}

export async function enfileirarEntregas(
  clienteId: string,
  evento: string,
  corpo: Record<string, unknown>,
  webhookIds: string[],
): Promise<string[]> {
  if (webhookIds.length === 0) return []
  const { data, error } = await db()
    .from('entregas_de_webhook')
    .insert(webhookIds.map((webhookId) => ({ webhook_id: webhookId, client_id: clienteId, evento, corpo })))
    .select('id')
  if (error) throw new Error(`não deu para enfileirar as entregas: ${error.message}`)
  return (data as { id: string }[]).map((linha) => linha.id)
}

export type EntregaParaEnviar = {
  id: string
  webhookId: string
  clienteId: string
  evento: string
  corpo: unknown
  tentativas: number
}

/** Trava e devolve as entregas vencidas (ver `pegar_entregas_de_webhook`). */
export async function pegarEntregas(limite: number, ids?: string[]): Promise<EntregaParaEnviar[]> {
  const { data, error } = await db().rpc('pegar_entregas_de_webhook', { p_limite: limite, p_ids: ids ?? null })
  if (tabelaAusente(error) || error?.code === 'PGRST202') return []
  if (error) throw new Error(`não deu para pegar as entregas: ${error.message}`)
  return (
    (data ?? []) as { id: string; webhook_id: string; client_id: string; evento: string; corpo: unknown; tentativas: number }[]
  ).map((linha) => ({
    id: linha.id,
    webhookId: linha.webhook_id,
    clienteId: linha.client_id,
    evento: linha.evento,
    corpo: linha.corpo,
    tentativas: linha.tentativas,
  }))
}

/** O destino e o segredo de um webhook, para enviar. `null` se sumiu. */
export async function destinoDoWebhook(
  webhookId: string,
): Promise<{ url: string; segredoId: string; ativo: boolean; falhasSeguidas: number } | null> {
  const { data, error } = await db()
    .from('webhooks_de_saida')
    .select('url, segredo_id, ativo, falhas_seguidas')
    .eq('id', webhookId)
    .maybeSingle()
  if (error) throw new Error(`não deu para ler o webhook: ${error.message}`)
  if (!data) return null
  const linha = data as { url: string; segredo_id: string; ativo: boolean; falhas_seguidas: number }
  return { url: linha.url, segredoId: linha.segredo_id, ativo: linha.ativo, falhasSeguidas: linha.falhas_seguidas }
}

export async function registrarTentativa(
  entregaId: string,
  dados: {
    status: 'pendente' | 'entregue' | 'falhou'
    tentativas: number
    statusHttp: number | null
    resposta: string | null
    proximaEm?: string
  },
): Promise<void> {
  const { error } = await db()
    .from('entregas_de_webhook')
    .update({
      status: dados.status,
      tentativas: dados.tentativas,
      ultimo_status_http: dados.statusHttp,
      resposta: dados.resposta ? dados.resposta.slice(0, 300) : null,
      travada_ate: null,
      ...(dados.proximaEm ? { proxima_em: dados.proximaEm } : {}),
      ...(dados.status === 'entregue' ? { entregue_em: new Date().toISOString() } : {}),
    })
    .eq('id', entregaId)
  if (error) throw new Error(`não deu para registrar a tentativa: ${error.message}`)
}

/** Entregou: as falhas seguidas do webhook zeram. */
export async function zerarFalhas(webhookId: string): Promise<void> {
  const { error } = await db().from('webhooks_de_saida').update({ falhas_seguidas: 0 }).eq('id', webhookId).gt('falhas_seguidas', 0)
  if (error) console.error('[webhooks] não deu para zerar as falhas:', error.message)
}

/** Mais uma falha; devolve se o webhook acabou de ser pausado. */
export async function somarFalha(webhookId: string, falhasAntes: number, teto: number): Promise<boolean> {
  const falhas = falhasAntes + 1
  const pausar = falhas >= teto
  const { error } = await db()
    .from('webhooks_de_saida')
    .update({ falhas_seguidas: falhas, ...(pausar ? { ativo: false, pausado_em: new Date().toISOString() } : {}) })
    .eq('id', webhookId)
  if (error) console.error('[webhooks] não deu para somar a falha:', error.message)
  return pausar
}
