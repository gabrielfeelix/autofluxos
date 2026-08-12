import 'server-only'
import { sessaoSchema, type Sessao } from '@/core/engine/types'
import { db } from '../db'

export type CanalSalvo = {
  id: string
  clienteId: string
  phoneNumberId: string
  flowId: string | null
  status: string
}

export type Contato = {
  id: string
  clienteId: string
  waId: string
  nome: string | null
  campos: Record<string, string>
}

export type SessaoSalva = {
  id: string
  flowVersionId: string
  sessao: Sessao
}

export async function acharCanalPorNumero(phoneNumberId: string): Promise<CanalSalvo | null> {
  const { data, error } = await db()
    .from('channels')
    .select('id, client_id, phone_number_id, flow_id, status')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar o canal: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    clienteId: data.client_id as string,
    phoneNumberId: data.phone_number_id as string,
    flowId: data.flow_id as string | null,
    status: data.status as string,
  }
}

export async function acharOuCriarContato(
  clienteId: string,
  waId: string,
  nome: string | null,
): Promise<Contato> {
  const { data, error } = await db()
    .from('contacts')
    .upsert({ client_id: clienteId, wa_id: waId, nome }, { onConflict: 'client_id,wa_id' })
    .select('id, client_id, wa_id, nome, campos')
    .single()

  if (error) throw new Error(`não deu para registrar o contato: ${error.message}`)

  return {
    id: data.id as string,
    clienteId: data.client_id as string,
    waId: data.wa_id as string,
    nome: data.nome as string | null,
    campos: (data.campos ?? {}) as Record<string, string>,
  }
}

/** A conversa mais recente deste contato neste número. */
export async function ultimaSessao(
  contatoId: string,
  canalId: string,
): Promise<SessaoSalva | null> {
  const { data, error } = await db()
    .from('sessions')
    .select('id, flow_version_id, no_atual, vars, tentativas, status')
    .eq('contact_id', contatoId)
    .eq('channel_id', canalId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar a sessão: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    flowVersionId: data.flow_version_id as string,
    sessao: sessaoSchema.parse({
      noAtual: data.no_atual,
      vars: data.vars ?? {},
      tentativas: data.tentativas,
      status: data.status,
    }),
  }
}

export async function criarSessao(
  contatoId: string,
  canalId: string,
  flowVersionId: string,
  sessao: Sessao,
): Promise<SessaoSalva> {
  const { data, error } = await db()
    .from('sessions')
    .insert({
      contact_id: contatoId,
      channel_id: canalId,
      flow_version_id: flowVersionId,
      no_atual: sessao.noAtual,
      vars: sessao.vars,
      tentativas: sessao.tentativas,
      status: sessao.status,
    })
    .select('id, flow_version_id')
    .single()

  if (error) throw new Error(`não deu para criar a sessão: ${error.message}`)
  return { id: data.id as string, flowVersionId: data.flow_version_id as string, sessao }
}

/**
 * Muda só o status, sem tocar no resto da sessão.
 *
 * Existe separado de `guardarSessao` de propósito: quem quer calar o bot não
 * tem uma `Sessao` na mão, e montar uma para passar ali apagaria `vars` e
 * `no_atual` — o que a conversa já coletou sumiria por causa de uma mudança de
 * estado que não tinha nada a ver com isso.
 */
export async function definirStatusDaSessao(
  id: string,
  status: Sessao['status'],
): Promise<void> {
  const { error } = await db().from('sessions').update({ status }).eq('id', id)
  if (error) throw new Error(`não deu para mudar o status da sessão: ${error.message}`)
}

export async function guardarSessao(id: string, sessao: Sessao): Promise<void> {
  const { error } = await db()
    .from('sessions')
    .update({
      no_atual: sessao.noAtual,
      vars: sessao.vars,
      tentativas: sessao.tentativas,
      status: sessao.status,
    })
    .eq('id', id)

  if (error) throw new Error(`não deu para guardar a sessão: ${error.message}`)
}

/**
 * Registra uma mensagem recebida.
 *
 * Devolve `false` quando ela já estava lá. A Meta reenvia o webhook se não
 * receber 200 a tempo; sem esta checagem, uma lentidão nossa viraria conversa
 * andando duas vezes. Quem garante é a constraint `unique` do banco, não uma
 * consulta anterior que poderia perder a corrida.
 */
export async function registrarEntrada(dados: {
  contatoId: string
  sessaoId: string | null
  waMessageId: string
  texto: string | null
  payload: unknown
}): Promise<boolean> {
  const { error } = await db().from('messages').insert({
    contact_id: dados.contatoId,
    session_id: dados.sessaoId,
    direcao: 'entrada',
    wa_message_id: dados.waMessageId,
    texto: dados.texto,
    payload: dados.payload,
  })

  if (error) {
    if (error.code === '23505') return false
    throw new Error(`não deu para registrar a mensagem: ${error.message}`)
  }
  return true
}

export async function registrarSaida(dados: {
  contatoId: string
  sessaoId: string | null
  texto: string
  payload?: unknown
}): Promise<void> {
  const { error } = await db().from('messages').insert({
    contact_id: dados.contatoId,
    session_id: dados.sessaoId,
    direcao: 'saida',
    texto: dados.texto,
    payload: dados.payload ?? null,
  })

  if (error) throw new Error(`não deu para registrar o envio: ${error.message}`)
}

/** O que o fluxo coletou vira coluna na tela de leads. */
export async function guardarCampo(
  contatoId: string,
  campos: Record<string, string>,
): Promise<void> {
  const { error } = await db().from('contacts').update({ campos }).eq('id', contatoId)
  if (error) throw new Error(`não deu para guardar o campo: ${error.message}`)
}

export async function registrarHandoff(sessaoId: string, motivo: string): Promise<void> {
  const { error } = await db().from('handoffs').insert({ session_id: sessaoId, motivo })
  if (error) throw new Error(`não deu para registrar o handoff: ${error.message}`)
}

/**
 * Tudo que responder um lead pelo painel exige, numa consulta só.
 *
 * Existe como função única porque as três coisas têm que vir do **mesmo**
 * contato: o número para onde mandar, o canal de onde sai (que é o número em
 * que a pessoa escreveu, não "algum" da conta), e quando ela falou pela última
 * vez — que é o que abre ou fecha a janela de 24h.
 *
 * `null` quando o contato não é deste cliente. Como em toda leitura por aqui,
 * o par (contato, cliente) vem junto: a URL é adivinhável.
 */
export type ContextoDeResposta = {
  waId: string
  canal: CanalSalvo
  /** A sessão mais recente, para o bot calar quando uma pessoa assume. */
  sessaoId: string | null
  /** Quando a pessoa escreveu pela última vez. `null` = nunca escreveu. */
  ultimaEntradaEm: string | null
}

export async function contextoDeResposta(
  clienteId: string,
  contatoId: string,
): Promise<ContextoDeResposta | null> {
  const { data: contato, error: erroDoContato } = await db()
    .from('contacts')
    .select('wa_id')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (erroDoContato) throw new Error(`não deu para achar o contato: ${erroDoContato.message}`)
  if (!contato) return null

  const [{ data: sessao, error: erroDaSessao }, { data: entrada, error: erroDaEntrada }] =
    await Promise.all([
      db()
        .from('sessions')
        .select('id, channel_id')
        .eq('contact_id', contatoId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db()
        .from('messages')
        .select('ts')
        .eq('contact_id', contatoId)
        .eq('direcao', 'entrada')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (erroDaSessao) throw new Error(`não deu para achar a sessão: ${erroDaSessao.message}`)
  if (erroDaEntrada) throw new Error(`não deu para achar a última mensagem: ${erroDaEntrada.message}`)

  const canal = await canalDaResposta(clienteId, (sessao as { channel_id: string } | null)?.channel_id)
  if (!canal) return null

  return {
    waId: contato.wa_id as string,
    canal,
    sessaoId: (sessao as { id: string } | null)?.id ?? null,
    ultimaEntradaEm: (entrada as { ts: string } | null)?.ts ?? null,
  }
}

/**
 * De qual número a resposta sai.
 *
 * O da sessão, sempre que houver: é o número em que a pessoa escreveu, e
 * responder por outro chega como mensagem de um desconhecido. Só quando não há
 * sessão nenhuma é que cai no primeiro canal ativo do cliente.
 */
async function canalDaResposta(
  clienteId: string,
  canalDaSessao: string | undefined,
): Promise<CanalSalvo | null> {
  const consulta = db().from('channels').select('id, client_id, phone_number_id, flow_id, status')

  const { data, error } = canalDaSessao
    ? await consulta.eq('id', canalDaSessao).maybeSingle()
    : await consulta
        .eq('client_id', clienteId)
        .eq('status', 'ativo')
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle()

  if (error) throw new Error(`não deu para achar o canal: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    clienteId: data.client_id as string,
    phoneNumberId: data.phone_number_id as string,
    flowId: data.flow_id as string | null,
    status: data.status as string,
  }
}

/**
 * "Já atendi esta pessoa."
 *
 * Faz **duas** coisas, e as duas são necessárias:
 *
 * 1. Resolve os handoffs abertos, que é o que tira o lead do vermelho. Sem
 *    isso a coluna `resolvido_em` nunca era escrita por código de aplicação —
 *    a tela mostrava "aguardando humano" para sempre e o contador só subia.
 * 2. Encerra a sessão. Uma sessão em `humano` faz o bot ficar calado com aquele
 *    contato **para sempre** (ver `tratarUma`), então resolver o handoff sem
 *    encerrar deixaria a pessoa fora do alcance do fluxo sem ninguém perceber.
 *    Encerrada, a próxima mensagem dela começa uma conversa nova.
 *
 * O `clienteId` vem junto pelo mesmo motivo de sempre: a URL é adivinhável, e
 * o contato de um cliente não se encerra pelo painel de outro.
 */
export async function encerrarAtendimento(
  clienteId: string,
  contatoId: string,
): Promise<{ ok: boolean }> {
  const { data: contato, error: erroDoContato } = await db()
    .from('contacts')
    .select('id')
    .eq('id', contatoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (erroDoContato) throw new Error(`não deu para achar o contato: ${erroDoContato.message}`)
  if (!contato) return { ok: false }

  const { data: sessoes, error: erroDasSessoes } = await db()
    .from('sessions')
    .select('id')
    .eq('contact_id', contatoId)

  if (erroDasSessoes) throw new Error(`não deu para achar as sessões: ${erroDasSessoes.message}`)

  const ids = (sessoes as { id: string }[]).map((s) => s.id)
  if (ids.length === 0) return { ok: true }

  const { error: erroDoHandoff } = await db()
    .from('handoffs')
    .update({ resolvido_em: new Date().toISOString() })
    .in('session_id', ids)
    .is('resolvido_em', null)

  if (erroDoHandoff) throw new Error(`não deu para resolver o handoff: ${erroDoHandoff.message}`)

  const { error: erroDaSessao } = await db()
    .from('sessions')
    .update({ status: 'encerrada' })
    .in('id', ids)
    .eq('status', 'humano')

  if (erroDaSessao) throw new Error(`não deu para encerrar a sessão: ${erroDaSessao.message}`)

  return { ok: true }
}

export async function vincularSessaoNaMensagem(
  waMessageId: string,
  sessaoId: string,
): Promise<void> {
  await db().from('messages').update({ session_id: sessaoId }).eq('wa_message_id', waMessageId)
}

export async function criarCanal(dados: {
  clienteId: string
  phoneNumberId: string
  wabaId?: string | null
  flowId?: string | null
}): Promise<CanalSalvo> {
  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: dados.clienteId,
      phone_number_id: dados.phoneNumberId.trim(),
      waba_id: dados.wabaId ?? null,
      flow_id: dados.flowId ?? null,
    })
    .select('id, client_id, phone_number_id, flow_id, status')
    .single()

  if (error) throw new Error(`não deu para conectar o número: ${error.message}`)
  return {
    id: data.id as string,
    clienteId: data.client_id as string,
    phoneNumberId: data.phone_number_id as string,
    flowId: data.flow_id as string | null,
    status: data.status as string,
  }
}

export async function listarCanais(clienteId: string): Promise<CanalSalvo[]> {
  const { data, error } = await db()
    .from('channels')
    .select('id, client_id, phone_number_id, flow_id, status')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar os canais: ${error.message}`)
  return (data as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    clienteId: c.client_id as string,
    phoneNumberId: c.phone_number_id as string,
    flowId: c.flow_id as string | null,
    status: c.status as string,
  }))
}
