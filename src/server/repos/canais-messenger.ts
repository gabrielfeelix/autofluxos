import 'server-only'
import { db, ehIdInvalido } from '../db'
import { type CanalSalvo, COLUNAS_DO_CANAL, paraCanal } from './conversas'

/**
 * A página do Facebook de um cliente, como canal do Messenger (0163).
 *
 * Mesma regra do Instagram e do Telegram: o token da página vai para o Vault
 * na escrita e só sai por `lerTokenDoCanal()`. As colunas próprias ficam aqui,
 * e não em `COLUNAS_DO_CANAL`, para o resto do produto não depender delas.
 */

export type CanalDoMessenger = CanalSalvo & { fbPageId: string; fbPageNome: string | null }

const COLUNAS = `${COLUNAS_DO_CANAL}, fb_page_id, fb_page_nome`

function paraCanalDoMessenger(linha: Record<string, unknown>): CanalDoMessenger {
  return {
    ...paraCanal(linha),
    fbPageId: String(linha.fb_page_id),
    fbPageNome: (linha.fb_page_nome ?? null) as string | null,
  }
}

export async function canalDoMessenger(clienteId: string): Promise<CanalDoMessenger | null> {
  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('provider', 'messenger')
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) return null
  return data ? paraCanalDoMessenger(data as Record<string, unknown>) : null
}

/** O canal pela página: é o `recipient.id` da mensagem e o `entry.id` do comentário. */
export async function acharCanalPorPagina(pageId: string): Promise<CanalDoMessenger | null> {
  const { data, error } = await db().from('channels').select(COLUNAS).eq('fb_page_id', pageId).maybeSingle()
  if (error || !data) return null
  return paraCanalDoMessenger(data as Record<string, unknown>)
}

/**
 * Liga a página, ou troca a página e o token do que já estava ligado.
 *
 * **Nasce com os fluxos do WhatsApp da conta**, como o chat do site: o
 * Messenger roda as mesmas automações (`fluxoProprio: false` em
 * `core/canais.ts`), e copiar os papéis do primeiro número ativo faz a página
 * responder no primeiro teste.
 */
export async function salvarPaginaDoMessenger(entrada: {
  clienteId: string
  pageId: string
  nome: string | null
  token: string
}): Promise<CanalDoMessenger> {
  const deOutro = await acharCanalPorPagina(entrada.pageId)
  if (deOutro && deOutro.clienteId !== entrada.clienteId) throw new Error('esta página já está ligada a outra conta')

  const existente = await canalDoMessenger(entrada.clienteId)
  if (existente?.tokenRef) {
    const { error: erroDoCofre } = await db().rpc('trocar_segredo', { alvo: existente.tokenRef, valor: entrada.token })
    if (erroDoCofre) throw new Error(`não foi possível guardar o token: ${erroDoCofre.message}`)
    const { data, error } = await db()
      .from('channels')
      .update({ fb_page_id: entrada.pageId, fb_page_nome: entrada.nome, status: 'ativo' })
      .eq('id', existente.id)
      .select(COLUNAS)
      .single()
    if (error) throw new Error(`não foi possível atualizar a página: ${error.message}`)
    return paraCanalDoMessenger(data as Record<string, unknown>)
  }

  const { data: numero } = await db()
    .from('channels')
    .select('flow_id, flow_boas_vindas_id, flow_midia_id, flow_pos_atendimento_id')
    .eq('client_id', entrada.clienteId)
    .eq('provider', 'cloud-api')
    .eq('status', 'ativo')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: segredo, error: erroDoCofre } = await db().rpc('criar_segredo', {
    valor: entrada.token,
    apelido: `messenger_${crypto.randomUUID()}`,
  })
  if (erroDoCofre) throw new Error(`não foi possível guardar o token: ${erroDoCofre.message}`)
  const tokenRef = segredo as string

  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: entrada.clienteId,
      provider: 'messenger',
      phone_number_id: null,
      fb_page_id: entrada.pageId,
      fb_page_nome: entrada.nome,
      token_ref: tokenRef,
      status: 'ativo',
      flow_id: numero?.flow_id ?? null,
      flow_boas_vindas_id: numero?.flow_boas_vindas_id ?? null,
      flow_midia_id: numero?.flow_midia_id ?? null,
      flow_pos_atendimento_id: numero?.flow_pos_atendimento_id ?? null,
    })
    .select(COLUNAS)
    .single()
  if (error) {
    // O segredo já está no cofre e a linha não nasceu: sem isto ele ficaria órfão.
    await db().rpc('apagar_segredo', { alvo: tokenRef })
    throw new Error(`não foi possível ligar a página: ${error.message}`)
  }
  return paraCanalDoMessenger(data as Record<string, unknown>)
}

/** Desliga a página. O gatilho da 0040 apaga o token do cofre junto. */
export async function desligarPaginaDoMessenger(clienteId: string): Promise<void> {
  const { error } = await db().from('channels').delete().eq('client_id', clienteId).eq('provider', 'messenger')
  if (error) throw new Error(`não foi possível desligar a página: ${error.message}`)
}
