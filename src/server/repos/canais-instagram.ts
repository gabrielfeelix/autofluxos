import 'server-only'
import { db } from '../db'
import { type CanalSalvo } from './conversas'

/**
 * A conta do Instagram de um cliente.
 *
 * **O token nunca passa por aqui de volta.** Mesma regra de `conexoes.ts`: o
 * valor vai para o Vault na escrita e sai por `lerTokenDoCanal()` na hora de
 * fazer a requisição. `CanalSalvo` não tem campo de token, e isso não é
 * disciplina de quem escreve a tela — é o tipo não permitindo.
 */

const COLUNAS =
  'id, client_id, provider, phone_number_id, ig_user_id, ig_username, token_ref, token_expira_em, flow_id, flow_boas_vindas_id, flow_midia_id, flow_pos_atendimento_id, status'

function paraCanal(linha: Record<string, unknown>): CanalSalvo {
  return {
    id: linha.id as string,
    clienteId: linha.client_id as string,
    provider: linha.provider as string,
    phoneNumberId: (linha.phone_number_id ?? null) as string | null,
    igUserId: (linha.ig_user_id ?? null) as string | null,
    igUsername: (linha.ig_username ?? null) as string | null,
    tokenRef: (linha.token_ref ?? null) as string | null,
    tokenExpiraEm: (linha.token_expira_em ?? null) as string | null,
    flowId: (linha.flow_id ?? null) as string | null,
    fluxoBoasVindasId: (linha.flow_boas_vindas_id ?? null) as string | null,
    fluxoMidiaId: (linha.flow_midia_id ?? null) as string | null,
    fluxoPosAtendimentoId: (linha.flow_pos_atendimento_id ?? null) as string | null,
    status: linha.status as string,
  }
}

/** A conta ligada a este cliente, ou `null`. Hoje é no máximo uma. */
export async function canalDoInstagram(clienteId: string): Promise<CanalSalvo | null> {
  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('provider', 'instagram')
    .maybeSingle()

  if (error) throw new Error(`não deu para achar a conta do Instagram: ${error.message}`)
  if (!data) return null

  return paraCanal(data as Record<string, unknown>)
}

/**
 * Guarda a conta recém-autorizada.
 *
 * **Reconectar é o caminho normal, não a exceção**: o token vence em 60 dias e
 * o dono do perfil vai passar por aqui de novo. Por isso a conta existente é
 * atualizada em vez de recusada — e o token velho é trocado no mesmo segredo,
 * não em um novo, para os fluxos já configurados continuarem apontando para o
 * mesmo canal.
 */
export async function salvarContaDoInstagram(entrada: {
  clienteId: string
  igUserId: string
  username: string | null
  token: string
  expiraEm: Date
}): Promise<CanalSalvo> {
  const existente = await canalDoInstagram(entrada.clienteId)

  /*
   * A mesma conta de outro cliente é erro, e precisa ser dito por extenso.
   *
   * O `unique` de `ig_user_id` (0040) barra no banco, mas com uma mensagem de
   * violação de restrição que não ajuda ninguém. E o caso é real: uma agência
   * com dois cadastros do mesmo negócio tentando ligar o mesmo @ nos dois.
   */
  const { data: deOutro } = await db()
    .from('channels')
    .select('id, client_id')
    .eq('ig_user_id', entrada.igUserId)
    .maybeSingle()

  if (deOutro && (deOutro as { client_id: string }).client_id !== entrada.clienteId) {
    throw new Error('esta conta do Instagram já está ligada a outro cliente')
  }

  if (existente?.tokenRef) {
    const { error: erroDoCofre } = await db().rpc('trocar_segredo', {
      alvo: existente.tokenRef,
      valor: entrada.token,
    })
    if (erroDoCofre) throw new Error(`não deu para guardar o token: ${erroDoCofre.message}`)

    const { data, error } = await db()
      .from('channels')
      .update({
        ig_user_id: entrada.igUserId,
        ig_username: entrada.username,
        token_expira_em: entrada.expiraEm.toISOString(),
        status: 'ativo',
      })
      .eq('id', existente.id)
      .select(COLUNAS)
      .single()

    if (error) throw new Error(`não deu para atualizar a conta: ${error.message}`)
    return paraCanal(data as Record<string, unknown>)
  }

  // O apelido no cofre leva um id aleatório pelo mesmo motivo de `conexoes.ts`:
  // ele precisa ser único e não pode vazar o nome do cliente para dentro do
  // Vault.
  const { data: segredo, error: erroDoCofre } = await db().rpc('criar_segredo', {
    valor: entrada.token,
    apelido: `instagram_${crypto.randomUUID()}`,
  })
  if (erroDoCofre) throw new Error(`não deu para guardar o token: ${erroDoCofre.message}`)

  const tokenRef = segredo as string

  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: entrada.clienteId,
      provider: 'instagram',
      // Nulo de propósito: o `check` da 0040 exige que canal de Instagram não
      // tenha número, e que canal de WhatsApp não tenha conta.
      phone_number_id: null,
      ig_user_id: entrada.igUserId,
      ig_username: entrada.username,
      token_ref: tokenRef,
      token_expira_em: entrada.expiraEm.toISOString(),
      status: 'ativo',
    })
    .select(COLUNAS)
    .single()

  if (error) {
    // O segredo já está no cofre e a linha não nasceu. Sem isto ele ficaria
    // órfão para sempre — e token órfão é token que ninguém revoga.
    await db().rpc('apagar_segredo', { alvo: tokenRef })
    throw new Error(`não deu para ligar a conta: ${error.message}`)
  }

  return paraCanal(data as Record<string, unknown>)
}

/** Desliga a conta. O gatilho da 0040 apaga o token do cofre junto. */
export async function desligarContaDoInstagram(clienteId: string): Promise<void> {
  const { error } = await db()
    .from('channels')
    .delete()
    .eq('client_id', clienteId)
    .eq('provider', 'instagram')

  if (error) throw new Error(`não deu para desligar a conta: ${error.message}`)
}

/**
 * Quantos dias faltam para o token vencer. Negativo = já venceu.
 *
 * Pura e recebendo `agora` pelo mesmo motivo dos outros cálculos de prazo do
 * projeto: a fronteira é o que precisa de teste, e teste preso ao relógio da
 * máquina não prova fronteira nenhuma.
 */
export function diasAteVencer(expiraEm: string | null, agora: Date = new Date()): number | null {
  if (!expiraEm) return null
  const restante = new Date(expiraEm).getTime() - agora.getTime()
  return Math.floor(restante / (24 * 60 * 60 * 1_000))
}
