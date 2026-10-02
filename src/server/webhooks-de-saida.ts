import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { request } from 'undici'
import type { Agent } from 'undici'
import {
  esperaDepoisDe,
  FALHAS_ATE_PAUSAR,
  foiEntregue,
  TEMPO_LIMITE_EM_MS,
  textoAssinado,
  type EventoDeWebhook,
} from '@/core/api/webhooks'
import { lerContatoDaApi, type ContatoDaApi } from './api/contatos'
import { lerDoCofre } from './cofre'
import { agenteFixadoEm } from './efeitos/http'
import { conferirEndereco } from './efeitos/rede'
import {
  assinantesDoEvento,
  destinoDoWebhook,
  enfileirarEntregas,
  pegarEntregas,
  registrarTentativa,
  somarFalha,
  zerarFalhas,
  type EntregaParaEnviar,
} from './repos/webhooks-de-saida'

/**
 * Webhooks de saída (fase 3): emitir, enviar e repetir.
 *
 * ---------------------------------------------------------------------------
 * Emitir nunca derruba quem emitiu
 * ---------------------------------------------------------------------------
 *
 * O evento nasce no meio de algo mais importante: a mensagem que chegou, o
 * cartão que a equipe arrastou, a venda registrada. Falhar ao enfileirar o
 * aviso vai para o log e para por ali. É a mesma decisão de `anotar`.
 *
 * ---------------------------------------------------------------------------
 * Quando a entrega acontece
 * ---------------------------------------------------------------------------
 *
 * A primeira tentativa sai no `after()` de quem emitiu, segundos depois do
 * evento. As novas tentativas (1 min, 5 min, 30 min, 2 h, 12 h) dependem de uma
 * passada, e no plano Hobby a Vercel só dispara cron uma vez por dia. Então a
 * passada pega as mesmas caronas das mensagens agendadas: o webhook do
 * WhatsApp e o pulso do Inbox, mais o cron diário como piso. Uma nova
 * tentativa pode sair depois do horário marcado, nunca antes.
 */

/** O corpo de todo POST. `dados.contato` vem sempre; o resto depende do evento. */
export type CorpoDoWebhook = {
  id: string
  evento: EventoDeWebhook | 'webhook.teste'
  criado_em: string
  organizacao_id: string
  dados: { contato: ContatoDaApi | null } & Record<string, unknown>
}

/**
 * Enfileira o evento para cada webhook ativo que o assina, e agenda a primeira
 * tentativa. Sem assinante, custa uma consulta e para.
 */
export async function emitirEvento(
  clienteId: string,
  evento: EventoDeWebhook,
  contatoId: string,
  dados: Record<string, unknown> = {},
): Promise<void> {
  try {
    const assinantes = await assinantesDoEvento(clienteId, evento)
    if (assinantes.length === 0) return

    const corpo: CorpoDoWebhook = {
      id: randomUUID(),
      evento,
      criado_em: new Date().toISOString(),
      organizacao_id: clienteId,
      dados: { contato: await lerContatoDaApi(clienteId, contatoId), ...dados },
    }
    const ids = await enfileirarEntregas(
      clienteId,
      evento,
      corpo,
      assinantes.map((a) => a.id),
    )
    agendarEnvio(ids)
  } catch (erro) {
    console.error(`[webhooks] não deu para emitir ${evento}:`, erro instanceof Error ? erro.message : erro)
  }
}

/**
 * A ponte com a linha do tempo: `anotar` chama isto para todo evento, e só
 * dois tipos viram webhook. Ganhar e perder não passam por aqui porque o banco
 * grava esses eventos direto (0072, 0080); quem emite é a conclusão.
 */
export async function emitirPelaAnotacao(
  clienteId: string,
  contatoId: string,
  tipo: string,
  dados: Record<string, unknown>,
): Promise<void> {
  if (tipo === 'chegou') {
    await emitirEvento(clienteId, 'contato.criado', contatoId, { origem: dados.origem ?? null })
  } else if (tipo === 'mudou-de-etapa') {
    await emitirEvento(clienteId, 'contato.etapa_mudou', contatoId, {
      oportunidade_id: dados.cartaoId ?? null,
      de: dados.de || null,
      para: dados.para || null,
    })
  }
}

/** A primeira tentativa, depois da resposta. Fora de requisição, a passada pega. */
function agendarEnvio(ids: string[]): void {
  if (ids.length === 0) return
  try {
    after(() => processarEntregas(ids.length, ids).then(() => undefined))
  } catch {
    // Sem contexto de requisição (script, teste): fica para a próxima passada.
  }
}

export type ResumoDaPassada = { enviadas: number; falharam: number }

/** Envia as entregas vencidas, até `limite`, em paralelo. */
export async function processarEntregas(limite = 20, ids?: string[]): Promise<ResumoDaPassada> {
  const entregas = await pegarEntregas(limite, ids)
  const resultados = await Promise.all(
    entregas.map((entrega) =>
      enviarUma(entrega).catch((erro) => {
        console.error('[webhooks] a entrega falhou sem registro:', erro instanceof Error ? erro.message : erro)
        return false
      }),
    ),
  )
  return { enviadas: resultados.filter(Boolean).length, falharam: resultados.filter((r) => !r).length }
}

/** Para as caronas: poucas por vez, a fila é do banco e a próxima continua. */
export const POR_CARONA = 5

async function enviarUma(entrega: EntregaParaEnviar): Promise<boolean> {
  const tentativas = entrega.tentativas + 1
  const destino = await destinoDoWebhook(entrega.webhookId)
  if (!destino || !destino.ativo) {
    await registrarTentativa(entrega.id, {
      status: 'falhou',
      tentativas: entrega.tentativas,
      statusHttp: null,
      resposta: 'O webhook foi pausado ou apagado antes do envio.',
    })
    return false
  }

  const segredo = await lerDoCofre(destino.segredoId)
  const resultado = segredo
    ? await postar(destino.url, JSON.stringify(entrega.corpo), segredo, entrega)
    : { statusHttp: null, resposta: 'O segredo do webhook não está no cofre. Gere um novo segredo.' }

  if (resultado.statusHttp !== null && foiEntregue(resultado.statusHttp)) {
    await registrarTentativa(entrega.id, { status: 'entregue', tentativas, statusHttp: resultado.statusHttp, resposta: resultado.resposta })
    await zerarFalhas(entrega.webhookId)
    return true
  }

  // O teste não repete: quem configura vê o resultado na hora e corrige.
  const espera = entrega.evento === 'webhook.teste' ? null : esperaDepoisDe(tentativas)
  await registrarTentativa(entrega.id, {
    status: espera === null ? 'falhou' : 'pendente',
    tentativas,
    statusHttp: resultado.statusHttp,
    resposta: resultado.resposta,
    ...(espera !== null ? { proximaEm: new Date(Date.now() + espera * 1000).toISOString() } : {}),
  })
  // O teste não conta para a pausa: é alguém configurando, não o destino caindo.
  if (entrega.evento !== 'webhook.teste') {
    await somarFalha(entrega.webhookId, destino.falhasSeguidas, FALHAS_ATE_PAUSAR)
  }
  return false
}

export function assinar(segredo: string, timestamp: number, corpo: string): string {
  return `sha256=${createHmac('sha256', segredo).update(textoAssinado(timestamp, corpo)).digest('hex')}`
}

/**
 * O POST, com a mesma defesa do bloco Chama um sistema: endereço resolvido e
 * conferido (nada de rede interna), conexão fixada no IP aprovado (sem segunda
 * resolução de DNS) e redirecionamento **não** seguido.
 */
async function postar(
  url: string,
  corpo: string,
  segredo: string,
  entrega: Pick<EntregaParaEnviar, 'id' | 'evento'>,
): Promise<{ statusHttp: number | null; resposta: string | null }> {
  const veredito = await conferirEndereco(url)
  if (!veredito.ok) return { statusHttp: null, resposta: `Endereço recusado: ${veredito.motivo}.` }

  const timestamp = Math.floor(Date.now() / 1000)
  const agentes: Agent[] = []
  try {
    const resposta = await request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'AutoFluxos-Webhooks/1.0',
        'x-autofluxos-evento': entrega.evento,
        'x-autofluxos-entrega': entrega.id,
        'x-autofluxos-timestamp': String(timestamp),
        'x-autofluxos-assinatura': assinar(segredo, timestamp, corpo),
      },
      body: corpo,
      headersTimeout: TEMPO_LIMITE_EM_MS,
      bodyTimeout: TEMPO_LIMITE_EM_MS,
      signal: AbortSignal.timeout(TEMPO_LIMITE_EM_MS),
      dispatcher: agenteFixadoEm(veredito.enderecos, agentes),
    })
    let texto = ''
    try {
      texto = (await resposta.body.text()).slice(0, 300)
    } catch {
      // Corpo ilegível não muda o veredito: o status já disse.
    }
    const status = resposta.statusCode
    const resumo = status >= 300 && status < 400 ? `Redirecionamento (${status}) não é seguido. Use o endereço final.` : texto || null
    return { statusHttp: status, resposta: resumo }
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : ''
    const porTempo = ['HeadersTimeoutError', 'BodyTimeoutError', 'TimeoutError', 'AbortError'].includes(nome)
    return {
      statusHttp: null,
      resposta: porTempo ? `Sem resposta em ${TEMPO_LIMITE_EM_MS / 1000} s.` : 'Não deu para conectar no endereço.',
    }
  } finally {
    await Promise.all(agentes.map((agente) => agente.close().catch(() => undefined)))
  }
}

/**
 * Um envio de teste, na hora, para quem está configurando. Entra na lista de
 * entregas como qualquer outro, com o evento `webhook.teste` e um contato de
 * exemplo.
 */
export async function enviarTeste(clienteId: string, webhookId: string): Promise<string | null> {
  const corpo: CorpoDoWebhook = {
    id: randomUUID(),
    evento: 'webhook.teste',
    criado_em: new Date().toISOString(),
    organizacao_id: clienteId,
    dados: {
      contato: {
        id: '00000000-0000-4000-8000-000000000000',
        nome: 'Contato de teste',
        telefone: '5511900000000',
        campos: { origem: 'Teste' },
        etiquetas: [],
        estagio: 'novo',
        criado_em: new Date().toISOString(),
      },
    },
  }
  const [id] = await enfileirarEntregas(clienteId, 'webhook.teste', corpo, [webhookId])
  if (!id) return null
  await processarEntregas(1, [id])
  return id
}
