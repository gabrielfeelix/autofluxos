import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * O webhook de entrada: quem pode chamar, e o que cada evento começa (0044).
 *
 * **Existe porque o produto já prometia isto em produção.** O preset
 * `verandi-espera` diz "te aviso se abrir"; a Verandi dispara o aviso e não
 * havia rota para recebê-lo. Esta é a metade que faltava.
 *
 * Como todo `repos/`: só ida ao banco. Quem decide se a assinatura confere é a
 * rota; quem decide o que o evento faz é o servidor.
 */

/** O que a tela pode ver de um webhook. Repare no que não está aqui: o segredo. */
export type WebhookDeEntrada = {
  id: string
  nome: string
  ativo: boolean
  ultimaEm: string | null
  criadoEm: string
}

type Linha = {
  id: string
  nome: string
  ativo: boolean
  ultima_em: string | null
  criado_em: string
}

const COLUNAS = 'id, nome, ativo, ultima_em, criado_em'

function paraWebhook(linha: Linha): WebhookDeEntrada {
  return {
    id: linha.id,
    nome: linha.nome,
    ativo: linha.ativo,
    ultimaEm: linha.ultima_em,
    criadoEm: linha.criado_em,
  }
}

export async function listarWebhooks(clienteId: string): Promise<WebhookDeEntrada[]> {
  const { data, error } = await db()
    .from('webhooks_de_entrada')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os webhooks: ${error.message}`)
  return (data as Linha[]).map(paraWebhook)
}

/**
 * Cria o webhook e **devolve o segredo uma única vez**.
 *
 * É a única vez que ele existe fora do cofre, e a tela precisa mostrá-lo agora
 * porque não há segunda chance — quem fechar sem copiar gera outro. É a mesma
 * escolha de todo token de API: guardar um jeito de reexibir é guardar um jeito
 * de vazar.
 *
 * O segredo é gerado **aqui**, e não recebido de quem cadastra. Deixar a pessoa
 * escolher produziria `123456` na conta de alguém — e um segredo fraco num
 * endereço público é o mesmo que endereço sem segredo.
 */
export async function criarWebhook(
  clienteId: string,
  nome: string,
): Promise<{ ok: true; id: string; segredo: string } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'dê um nome ao webhook' }

  // 32 bytes de aleatoriedade criptográfica. `randomUUID` teria 122 bits e
  // versão embutida; aqui não há motivo para entregar menos que o máximo.
  const segredo = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')

  const { data: segredoId, error: erroDoCofre } = await db().rpc('criar_segredo', {
    valor: segredo,
    apelido: `webhook_${crypto.randomUUID()}`,
  })
  if (erroDoCofre) throw new Error(`não deu para guardar o segredo: ${erroDoCofre.message}`)
  if (typeof segredoId !== 'string') throw new Error('o cofre não devolveu uma referência')

  const { data, error } = await db()
    .from('webhooks_de_entrada')
    .insert({ client_id: clienteId, nome: limpo, secret_id: segredoId })
    .select('id')
    .single()

  if (error) {
    // O segredo já está no cofre e a linha não nasceu. Sem isto ele ficaria
    // órfão para sempre — a mesma correção de `criarConexao`.
    await db().rpc('apagar_segredo', { alvo: segredoId })
    throw new Error(`não deu para criar o webhook: ${error.message}`)
  }

  return { ok: true, id: (data as { id: string }).id, segredo }
}

export async function alternarWebhook(
  clienteId: string,
  webhookId: string,
  ativo: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('webhooks_de_entrada')
    .update({ ativo })
    .eq('id', webhookId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para alterar o webhook: ${error.message}`)
  return data !== null
}

/**
 * Apaga o webhook **e o segredo dele**.
 *
 * O cofre primeiro seria o erro: se a linha falhasse depois, sobraria um
 * webhook cadastrado cujo segredo não existe mais — e toda chamada dele
 * responderia 401 sem ninguém entender por quê. Assim, o pior caso é um
 * segredo órfão no cofre, que não abre porta nenhuma porque a linha sumiu.
 */
export async function apagarWebhook(clienteId: string, webhookId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('webhooks_de_entrada')
    .delete()
    .eq('id', webhookId)
    .eq('client_id', clienteId)
    .select('secret_id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o webhook: ${error.message}`)
  if (!data) return false

  await db().rpc('apagar_segredo', { alvo: (data as { secret_id: string }).secret_id })
  return true
}

/**
 * Os segredos ativos desta conta, para conferir a assinatura.
 *
 * **Devolve uma lista, e isso é de propósito.** A chamada não diz qual webhook
 * ela é — ela traz uma assinatura e mais nada. Exigir um id no caminho daria a
 * quem chama uma forma de enumerar webhooks de outras contas; conferir contra
 * todos os ativos da conta resolve sem expor nada.
 *
 * Uma conta tem um ou dois webhooks na prática, então a lista é curta. Quem
 * cadastrar dez paga dez comparações de HMAC, que é barato perto de uma ida ao
 * banco.
 *
 * O valor sai do cofre aqui e morre no fim da requisição — nunca é serializado,
 * nunca chega ao navegador. Mesma regra de `lerCredencial`.
 */
export async function segredosAtivos(
  clienteId: string,
): Promise<{ id: string; segredo: string }[]> {
  const { data, error } = await db()
    .from('webhooks_de_entrada')
    .select('id, secret_id')
    .eq('client_id', clienteId)
    .eq('ativo', true)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os webhooks: ${error.message}`)

  const linhas = data as { id: string; secret_id: string }[]
  const segredos: { id: string; segredo: string }[] = []

  for (const linha of linhas) {
    const { data: valor, error: erroDoCofre } = await db().rpc('ler_segredo', {
      alvo: linha.secret_id,
    })
    // Segredo que sumiu do cofre não pode derrubar a conferência dos outros:
    // um webhook quebrado calaria a integração inteira da conta.
    if (erroDoCofre || typeof valor !== 'string' || valor === '') continue
    segredos.push({ id: linha.id, segredo: valor })
  }

  return segredos
}

/** Marca que uma chamada válida chegou. É o que responde "isto ainda está vivo?". */
export async function marcarChamada(webhookId: string): Promise<void> {
  const { error } = await db()
    .from('webhooks_de_entrada')
    .update({ ultima_em: new Date().toISOString() })
    .eq('id', webhookId)

  // Perder o carimbo não pode custar o evento. Vira log e a chamada segue.
  if (error) console.error('[webhook] não deu para marcar a chamada', error.message)
}

// ---------------------------------------------------------------------------
// Evento -> fluxo
// ---------------------------------------------------------------------------

export type GatilhoDeEvento = {
  id: string
  evento: string
  fluxoId: string
  ativo: boolean
  execucoes: number
}

type LinhaDoGatilho = {
  id: string
  evento: string
  flow_id: string
  ativo: boolean
  execucoes: number
}

const COLUNAS_DO_GATILHO = 'id, evento, flow_id, ativo, execucoes'

function paraGatilho(linha: LinhaDoGatilho): GatilhoDeEvento {
  return {
    id: linha.id,
    evento: linha.evento,
    fluxoId: linha.flow_id,
    ativo: linha.ativo,
    execucoes: linha.execucoes,
  }
}

export async function listarGatilhosDeEvento(clienteId: string): Promise<GatilhoDeEvento[]> {
  const { data, error } = await db()
    .from('gatilhos_de_evento')
    .select(COLUNAS_DO_GATILHO)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os gatilhos de evento: ${error.message}`)
  return (data as LinhaDoGatilho[]).map(paraGatilho)
}

/**
 * O gatilho **ativo** desta conta para este evento, ou `null`.
 *
 * A comparação é por nome exato, sem normalizar — quem escolhe o nome é o
 * sistema do outro lado, e `vaga.aberta` e `Vaga.Aberta` podem ser dois eventos
 * diferentes lá. O índice único usa `lower(trim())` só para impedir cadastro
 * ambíguo na nossa tela; casar continua exato.
 */
export async function acharGatilhoDeEvento(
  clienteId: string,
  evento: string,
): Promise<GatilhoDeEvento | null> {
  const { data, error } = await db()
    .from('gatilhos_de_evento')
    .select(COLUNAS_DO_GATILHO)
    .eq('client_id', clienteId)
    .eq('evento', evento)
    .eq('ativo', true)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para achar o gatilho de evento: ${error.message}`)
  return data ? paraGatilho(data as LinhaDoGatilho) : null
}

export async function criarGatilhoDeEvento(
  clienteId: string,
  evento: string,
  fluxoId: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const limpo = evento.trim()
  if (limpo === '') return { ok: false, motivo: 'diga o nome do evento' }
  if (limpo.length > 120) return { ok: false, motivo: 'o nome do evento é longo demais' }

  // O fluxo é conferido contra o **mesmo cliente**: o id vem de formulário, e a
  // chave estrangeira só sabe que ele existe em algum lugar.
  const { data: fluxo, error: erroDoFluxo } = await db()
    .from('flows')
    .select('id')
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'escolha um fluxo válido' }
  if (erroDoFluxo) throw new Error(`não deu para conferir o fluxo: ${erroDoFluxo.message}`)
  if (!fluxo) return { ok: false, motivo: 'este fluxo não é deste cliente' }

  const { data, error } = await db()
    .from('gatilhos_de_evento')
    .insert({ client_id: clienteId, evento: limpo, flow_id: fluxoId })
    .select('id')
    .single()

  if (error?.code === '23505') {
    return { ok: false, motivo: `já existe um gatilho para “${limpo}”` }
  }
  if (error) throw new Error(`não deu para criar o gatilho de evento: ${error.message}`)
  return { ok: true, id: (data as { id: string }).id }
}

export async function alternarGatilhoDeEvento(
  clienteId: string,
  gatilhoId: string,
  ativo: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('gatilhos_de_evento')
    .update({ ativo })
    .eq('id', gatilhoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para alterar o gatilho: ${error.message}`)
  return data !== null
}

export async function apagarGatilhoDeEvento(
  clienteId: string,
  gatilhoId: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from('gatilhos_de_evento')
    .delete()
    .eq('id', gatilhoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o gatilho: ${error.message}`)
  return data !== null
}

/** Conta o disparo. Perder a contagem nunca pode custar o evento. */
export async function contarDisparoDeEvento(gatilhoId: string): Promise<void> {
  const { error } = await db().rpc('contar_disparo_de_evento', { p_gatilho: gatilhoId })
  if (error) console.error('[webhook] não deu para contar o disparo', error.message)
}
