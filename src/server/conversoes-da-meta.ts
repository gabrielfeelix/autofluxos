import 'server-only'
import { after } from 'next/server'
import { alertar } from './alertar'
import { db, ehIdInvalido } from './db'
import { anotar } from './repos/eventos'
import { type CanalSalvo, lerTokenDoCanal } from './repos/conversas'

/**
 * Devolver para a Meta o que a conversa virou (docs/PLANO-9-DA-COLMEIA.md, 7).
 *
 * Quem chegou por anúncio de clique para o WhatsApp trouxe o `ctwa_clid`, que
 * guardamos na ficha desde a primeira mensagem (`campos.origem_clique`). Aqui
 * ele volta para a Meta pela Conversions API for Business Messaging, e é com
 * ele que o anúncio aprende quem vira cliente, e não só quem clica.
 *
 * Dois eventos, os dois da lista oficial (`Lead` não é aceito para mensagem):
 *
 * - `LeadSubmitted`, a primeira vez que o contato entra num funil;
 * - `Purchase`, quando a venda é ganha, com o valor em reais.
 *
 * **Uma vez por contato e evento.** A Meta não deduplica; quem deduplica é a
 * linha `conversao-enviada` na linha do tempo da ficha. O conjunto de dados
 * vem de `POST /{waba}/dataset`, que devolve o mesmo id se já existir.
 *
 * Depende de o app ter `whatsapp_business_manage_events`; sem ela a Meta
 * recusa, e a recusa vira alerta, nunca erro para quem clicou em "ganhou".
 */

export type EventoDeConversao = 'LeadSubmitted' | 'Purchase'

const VERSAO = process.env.META_GRAPH_VERSION ?? 'v25.0'
const DATASETS = new Map<string, string>()

export function payloadDaConversao(entrada: {
  evento: EventoDeConversao
  wabaId: string
  clique: string
  quando: Date
  valor?: number | null
}): Record<string, unknown> {
  return {
    data: [
      {
        event_name: entrada.evento,
        event_time: Math.floor(entrada.quando.getTime() / 1000),
        action_source: 'business_messaging',
        messaging_channel: 'whatsapp',
        user_data: { whatsapp_business_account_id: entrada.wabaId, ctwa_clid: entrada.clique },
        ...(entrada.evento === 'Purchase' && typeof entrada.valor === 'number'
          ? { custom_data: { currency: 'BRL', value: Math.round(entrada.valor * 100) / 100 } }
          : {}),
      },
    ],
  }
}

async function graph(caminho: string, token: string, corpo?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resposta = await fetch(`https://graph.facebook.com/${VERSAO}/${caminho}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
    signal: AbortSignal.timeout(10_000),
  })
  const lido = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok) {
    const erro = lido.error as { message?: string; code?: number } | undefined
    throw new Error(`a Meta recusou (${caminho.split('/')[1] ?? caminho}): ${erro?.message ?? resposta.status} [${erro?.code ?? ''}]`)
  }
  return lido
}

async function enviar(clienteId: string, contatoId: string, evento: EventoDeConversao, valor?: number | null): Promise<void> {
  const { data: contato } = await db().from('contacts').select('campos').eq('id', contatoId).eq('client_id', clienteId).maybeSingle()
  const clique = (contato?.campos as Record<string, unknown> | null)?.origem_clique
  if (typeof clique !== 'string' || clique === '') return

  const { data: jaFoi, error: erroDaLeitura } = await db()
    .from('eventos_do_contato')
    .select('id')
    .eq('contato_id', contatoId)
    .eq('tipo', 'conversao-enviada')
    .contains('dados', { evento })
    .limit(1)
  if (erroDaLeitura && !ehIdInvalido(erroDaLeitura)) throw erroDaLeitura
  if ((jaFoi ?? []).length > 0) return

  const { data: canais } = await db()
    .from('channels')
    .select('id, waba_id, token_ref')
    .eq('client_id', clienteId)
    .eq('provider', 'cloud-api')
    .eq('status', 'ativo')
    .not('waba_id', 'is', null)
    .not('token_ref', 'is', null)
    .limit(1)
  const canal = (canais ?? [])[0] as { waba_id: string; token_ref: string } | undefined
  if (!canal) return

  const token = await lerTokenDoCanal({ tokenRef: canal.token_ref } as CanalSalvo)
  let dataset = DATASETS.get(canal.waba_id)
  if (!dataset) {
    dataset = String((await graph(`${canal.waba_id}/dataset`, token)).id ?? '')
    if (!dataset) throw new Error('a Meta não devolveu o conjunto de dados da WABA')
    DATASETS.set(canal.waba_id, dataset)
  }

  await graph(`${dataset}/events`, token, payloadDaConversao({ evento, wabaId: canal.waba_id, clique, quando: new Date(), valor }))
  await anotar(clienteId, contatoId, 'conversao-enviada', { evento })
}

/**
 * Agenda o envio para depois da resposta, e nunca lança.
 *
 * Quem chama está no meio de "registrar venda" ou de mover um cartão: duas
 * idas à Meta ali dentro atrasariam o clique de alguém. Fora de uma requisição
 * (um teste, um cron) o `after` não existe, e aí roda na hora.
 */
export function avisarConversao(clienteId: string, contatoId: string, evento: EventoDeConversao, valor?: number | null): void {
  const tarefa = () =>
    enviar(clienteId, contatoId, evento, valor).catch((erro) =>
      alertar('não foi possível devolver a conversão para a Meta', erro, { contato: contatoId, evento }),
    )
  try {
    after(tarefa)
  } catch {
    void tarefa()
  }
}
