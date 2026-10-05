'use server'

import { z } from 'zod'
import { ehEscopoDaApi, type EscopoDaApi } from '@/core/api/chaves'
import { recusaDoPlano } from './recursos-do-plano'
import { registrar } from './repos/auditoria'
import { criarChaveDeApi, revogarChaveDeApi, type ChaveDeApi } from './repos/chaves-de-api'
import { exigirCapacidade, recusou, type AcessoCompleto } from './permissoes'
import { ehEventoDeWebhook, WEBHOOKS_POR_ORGANIZACAO, type EventoDeWebhook } from '@/core/api/webhooks'
import { conferirEndereco } from './efeitos/rede'
import {
  apagarWebhook,
  criarWebhook,
  editarWebhook,
  listarWebhooks,
  trocarSegredoDoWebhook,
  ultimasEntregas,
  type EntregaDeWebhook,
  type WebhookDeSaida,
} from './repos/webhooks-de-saida'
import { enviarTeste } from './webhooks-de-saida'

/**
 * Criar e revogar chaves da API pública (Configurações > API).
 *
 * **Só quem administra a conta**: a chave fala pela organização inteira, sem
 * sessão de ninguém por trás. A pergunta é `configurar_empresa` no escopo
 * `todos`, a mesma régua do antigo `podeAdministrarConta`: dono e
 * administrador passam, `member` não. As duas vão para `af_auditoria` com o `publico`,
 * nunca com a chave.
 *
 * Sem `revalidatePath`: a tela é otimista e troca a linha pela que volta daqui.
 */

export type RespostaDaCriacao =
  | { ok: true; chave: ChaveDeApi; inteira: string }
  | { ok: false; erro: string }

export async function acaoCriarChaveDeApi(
  clienteId: string,
  dados: { nome: string; escopos: string[] },
): Promise<RespostaDaCriacao> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Só quem administra a organização pode criar chaves.' }

  const recusa = await recusaDoPlano(clienteId, 'api')
  if (recusa) return { ok: false, erro: recusa }

  const nome = String(dados?.nome ?? '').trim()
  if (nome === '') return { ok: false, erro: 'Dê um nome para a chave.' }
  if (nome.length > 80) return { ok: false, erro: 'Nome com no máximo 80 caracteres.' }

  const escopos = [...new Set(Array.isArray(dados?.escopos) ? dados.escopos : [])]
  if (escopos.length === 0) return { ok: false, erro: 'Marque ao menos uma permissão.' }
  if (!escopos.every(ehEscopoDaApi)) return { ok: false, erro: 'Permissão desconhecida.' }

  try {
    const { chave, inteira } = await criarChaveDeApi(clienteId, {
      nome,
      escopos: escopos as EscopoDaApi[],
      autorId: acesso.sessao.usuario.id,
      autorNome: acesso.sessao.usuario.nome || acesso.sessao.usuario.email,
    })
    await registrar({
      acao: 'criou_chave_de_api',
      autorId: acesso.sessao.usuario.id,
      autorEmail: acesso.sessao.usuario.email,
      contaId: clienteId,
      alvoTipo: 'chave_de_api',
      alvoId: chave.id,
      alvoNome: `${chave.nome} (${chave.publico})`,
      detalhes: { escopos: chave.escopos },
      impersonadoPor: acesso.sessao.impersonadoPor,
    })
    return { ok: true, chave, inteira }
  } catch (erro) {
    console.error('[api] não deu para criar a chave:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para criar a chave agora. Tente de novo.' }
  }
}

export async function acaoRevogarChaveDeApi(
  clienteId: string,
  chaveId: string,
): Promise<{ ok: true; chave: ChaveDeApi } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Só quem administra a organização pode revogar chaves.' }
  if (!z.guid().safeParse(chaveId).success) return { ok: false, erro: 'Chave inválida.' }

  try {
    const chave = await revogarChaveDeApi(clienteId, chaveId)
    if (!chave) return { ok: false, erro: 'Esta chave não existe ou já foi revogada.' }
    await registrar({
      acao: 'revogou_chave_de_api',
      autorId: acesso.sessao.usuario.id,
      autorEmail: acesso.sessao.usuario.email,
      contaId: clienteId,
      alvoTipo: 'chave_de_api',
      alvoId: chave.id,
      alvoNome: `${chave.nome} (${chave.publico})`,
      impersonadoPor: acesso.sessao.impersonadoPor,
    })
    return { ok: true, chave }
  } catch (erro) {
    console.error('[api] não deu para revogar a chave:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para revogar agora. Tente de novo.' }
  }
}

/* ------------------------------------------------------------ webhooks */

/*
 * Webhooks de saída (fase 3). Mesma regra das chaves: só quem administra, com
 * o plano liberando a API, e tudo na auditoria. O segredo aparece uma vez, na
 * criação e na troca, e nunca vai para a auditoria.
 */

/*
 * A pergunta de quem é fica **na própria ação**, e não num ajudante: a trava
 * de `acoes.test.ts` lê o corpo de cada ação, e uma guarda escondida numa
 * função à parte é invisível para ela. O ajudante que sobra é só o do plano,
 * que roda depois de a capacidade ter sido conferida.
 */

type Acesso = AcessoCompleto

const SO_QUEM_ADMINISTRA = 'Só quem administra a organização pode mexer nos webhooks.'

async function recusaDaApiNoPlano(clienteId: string): Promise<{ ok: false; erro: string } | null> {
  const recusa = await recusaDoPlano(clienteId, 'api')
  return recusa ? { ok: false, erro: recusa } : null
}

async function conferirUrlEEventos(
  url: unknown,
  eventos: unknown,
): Promise<{ ok: true; url: string; eventos: EventoDeWebhook[] } | { ok: false; erro: string }> {
  const limpa = String(url ?? '').trim()
  if (!/^https:\/\//i.test(limpa)) return { ok: false, erro: 'O endereço precisa começar com https://.' }
  if (limpa.length > 2000) return { ok: false, erro: 'Endereço longo demais.' }
  // A conferência de verdade é no envio (o DNS pode mudar). Aqui é para a
  // pessoa saber já, e não pela primeira entrega falhando.
  const veredito = await conferirEndereco(limpa)
  if (!veredito.ok) return { ok: false, erro: `Endereço recusado: ${veredito.motivo}.` }
  const lista = [...new Set(Array.isArray(eventos) ? eventos : [])]
  if (lista.length === 0) return { ok: false, erro: 'Marque ao menos um evento.' }
  if (!lista.every(ehEventoDeWebhook)) return { ok: false, erro: 'Evento desconhecido.' }
  return { ok: true, url: limpa, eventos: lista as EventoDeWebhook[] }
}

function auditar(acesso: Acesso, clienteId: string, acao: string, webhook: WebhookDeSaida, detalhes?: Record<string, unknown>) {
  return registrar({
    acao,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'webhook_de_saida',
    alvoId: webhook.id,
    alvoNome: webhook.url,
    ...(detalhes ? { detalhes } : {}),
    impersonadoPor: acesso.sessao.impersonadoPor,
  })
}

export async function acaoCriarWebhook(
  clienteId: string,
  dados: { url: string; eventos: string[] },
): Promise<{ ok: true; webhook: WebhookDeSaida; segredo: string } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: SO_QUEM_ADMINISTRA }
  const semApi = await recusaDaApiNoPlano(clienteId)
  if (semApi) return semApi
  const conferido = await conferirUrlEEventos(dados?.url, dados?.eventos)
  if (!conferido.ok) return conferido

  try {
    if ((await listarWebhooks(clienteId)).length >= WEBHOOKS_POR_ORGANIZACAO) {
      return { ok: false, erro: `No máximo ${WEBHOOKS_POR_ORGANIZACAO} webhooks por organização.` }
    }
    const { webhook, segredo } = await criarWebhook(clienteId, {
      url: conferido.url,
      eventos: conferido.eventos,
      autorId: acesso.sessao.usuario.id,
    })
    await auditar(acesso, clienteId, 'criou_webhook_de_saida', webhook, { eventos: webhook.eventos })
    return { ok: true, webhook, segredo }
  } catch (erro) {
    console.error('[api] não deu para criar o webhook:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para criar o webhook agora. Tente de novo.' }
  }
}

export async function acaoEditarWebhook(
  clienteId: string,
  webhookId: string,
  dados: { url?: string; eventos?: string[]; ativo?: boolean },
): Promise<{ ok: true; webhook: WebhookDeSaida } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: SO_QUEM_ADMINISTRA }
  const semApi = await recusaDaApiNoPlano(clienteId)
  if (semApi) return semApi
  if (!z.guid().safeParse(webhookId).success) return { ok: false, erro: 'Webhook inválido.' }

  const mudanca: { url?: string; eventos?: EventoDeWebhook[]; ativo?: boolean } = {}
  if (dados?.url !== undefined || dados?.eventos !== undefined) {
    const conferido = await conferirUrlEEventos(dados.url, dados.eventos)
    if (!conferido.ok) return conferido
    mudanca.url = conferido.url
    mudanca.eventos = conferido.eventos
  }
  if (typeof dados?.ativo === 'boolean') mudanca.ativo = dados.ativo

  try {
    const webhook = await editarWebhook(clienteId, webhookId, mudanca)
    if (!webhook) return { ok: false, erro: 'Este webhook não existe mais.' }
    await auditar(acesso, clienteId, 'editou_webhook_de_saida', webhook, {
      eventos: webhook.eventos,
      ativo: webhook.ativo,
    })
    return { ok: true, webhook }
  } catch (erro) {
    console.error('[api] não deu para editar o webhook:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para salvar agora. Tente de novo.' }
  }
}

export async function acaoApagarWebhook(clienteId: string, webhookId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: SO_QUEM_ADMINISTRA }
  const semApi = await recusaDaApiNoPlano(clienteId)
  if (semApi) return semApi
  if (!z.guid().safeParse(webhookId).success) return { ok: false, erro: 'Webhook inválido.' }
  try {
    const webhook = await apagarWebhook(clienteId, webhookId)
    if (!webhook) return { ok: false, erro: 'Este webhook não existe mais.' }
    await auditar(acesso, clienteId, 'apagou_webhook_de_saida', webhook)
    return { ok: true }
  } catch (erro) {
    console.error('[api] não deu para apagar o webhook:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para apagar agora. Tente de novo.' }
  }
}

export async function acaoTrocarSegredoDoWebhook(
  clienteId: string,
  webhookId: string,
): Promise<{ ok: true; segredo: string } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: SO_QUEM_ADMINISTRA }
  const semApi = await recusaDaApiNoPlano(clienteId)
  if (semApi) return semApi
  if (!z.guid().safeParse(webhookId).success) return { ok: false, erro: 'Webhook inválido.' }
  try {
    const segredo = await trocarSegredoDoWebhook(clienteId, webhookId)
    if (!segredo) return { ok: false, erro: 'Este webhook não existe mais.' }
    const webhook = (await listarWebhooks(clienteId)).find((w) => w.id === webhookId)
    if (webhook) await auditar(acesso, clienteId, 'editou_webhook_de_saida', webhook, { segredo: 'trocado' })
    return { ok: true, segredo }
  } catch (erro) {
    console.error('[api] não deu para trocar o segredo:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para trocar o segredo agora. Tente de novo.' }
  }
}

/** Manda um evento de teste na hora e devolve as entregas atualizadas. */
export async function acaoTestarWebhook(
  clienteId: string,
  webhookId: string,
): Promise<{ ok: true; entrega: EntregaDeWebhook | null; entregas: EntregaDeWebhook[] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return { ok: false, erro: SO_QUEM_ADMINISTRA }
  const semApi = await recusaDaApiNoPlano(clienteId)
  if (semApi) return semApi
  if (!z.guid().safeParse(webhookId).success) return { ok: false, erro: 'Webhook inválido.' }
  try {
    if (!(await listarWebhooks(clienteId)).some((w) => w.id === webhookId)) {
      return { ok: false, erro: 'Este webhook não existe mais.' }
    }
    const id = await enviarTeste(clienteId, webhookId)
    const entregas = await ultimasEntregas(clienteId)
    return { ok: true, entrega: entregas.find((e) => e.id === id) ?? null, entregas }
  } catch (erro) {
    console.error('[api] não deu para testar o webhook:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para enviar o teste agora. Tente de novo.' }
  }
}
