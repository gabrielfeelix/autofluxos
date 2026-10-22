import 'server-only'
import type { Gateway } from '@/channels/pagamento'
import { db, ehIdInvalido } from '../db'

/**
 * As cobranças feitas pela conversa (0141, `cobrancas`).
 *
 * Aqui é só a ida ao banco. Quem decide quando uma cobrança vira paga ou
 * vencida é `server/cobrancas.ts`, e toda mudança de status passa por
 * `mudarStatus`, que só muda **a partir** dos status que fazem sentido: o
 * mesmo aviso de pagamento chegando duas vezes muda uma vez só, e uma
 * cobrança paga nunca volta a vencida porque o relógio passou depois.
 */

export const STATUS_DE_COBRANCA = ['pendente', 'paga', 'vencida', 'cancelada', 'estornada'] as const
export type StatusDeCobranca = (typeof STATUS_DE_COBRANCA)[number]
export type OrigemDaCobranca = 'inbox' | 'fluxo' | 'ia'

export type ItemCobrado = { nome: string; quantidade: number; valorCentavos: number }

export type CobrancaRegistrada = {
  id: string
  clienteId: string
  contatoId: string | null
  gateway: Gateway
  valorCentavos: number
  descricao: string
  itens: ItemCobrado[] | null
  status: StatusDeCobranca
  pagamentoNoGateway: string | null
  preferenciaNoGateway: string | null
  pixCopiaCola: string | null
  link: string | null
  venceEm: string
  pagaEm: string | null
  canceladaEm: string | null
  origem: OrigemDaCobranca
  criadaPor: string | null
  sessaoId: string | null
  criadoEm: string
}

type Linha = {
  id: string
  cliente_id: string
  contato_id: string | null
  gateway: Gateway
  valor_centavos: number
  descricao: string
  itens: ItemCobrado[] | null
  status: StatusDeCobranca
  pagamento_no_gateway: string | null
  preferencia_no_gateway: string | null
  pix_copia_cola: string | null
  link: string | null
  vence_em: string
  paga_em: string | null
  cancelada_em: string | null
  origem: OrigemDaCobranca
  criada_por: string | null
  sessao_id: string | null
  criado_em: string
}

const COLUNAS =
  'id, cliente_id, contato_id, gateway, valor_centavos, descricao, itens, status, pagamento_no_gateway, preferencia_no_gateway, pix_copia_cola, link, vence_em, paga_em, cancelada_em, origem, criada_por, sessao_id, criado_em'

function paraCobranca(l: Linha): CobrancaRegistrada {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    contatoId: l.contato_id,
    gateway: l.gateway,
    valorCentavos: l.valor_centavos,
    descricao: l.descricao,
    itens: l.itens,
    status: l.status,
    pagamentoNoGateway: l.pagamento_no_gateway,
    preferenciaNoGateway: l.preferencia_no_gateway,
    pixCopiaCola: l.pix_copia_cola,
    link: l.link,
    venceEm: l.vence_em,
    pagaEm: l.paga_em,
    canceladaEm: l.cancelada_em,
    origem: l.origem,
    criadaPor: l.criada_por,
    sessaoId: l.sessao_id,
    criadoEm: l.criado_em,
  }
}

/** Mesmo critério de `repos/pagamentos.ts`: código no ar antes da 0141 lê "nenhuma cobrança". */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/**
 * A linha nasce **antes** de o gateway saber da cobrança: o id dela é a
 * referência que viaja no pagamento, e é por ele que o aviso volta. Se o
 * gateway recusar, `apagarCobrancaQueNaoSaiu` desfaz.
 */
export async function inserirCobranca(entrada: {
  clienteId: string
  contatoId: string | null
  gateway: Gateway
  valorCentavos: number
  descricao: string
  itens: ItemCobrado[] | null
  venceEm: Date
  origem: OrigemDaCobranca
  criadaPor: string | null
  sessaoId: string | null
}): Promise<string> {
  const { data, error } = await db()
    .from('cobrancas')
    .insert({
      cliente_id: entrada.clienteId,
      contato_id: entrada.contatoId,
      gateway: entrada.gateway,
      valor_centavos: entrada.valorCentavos,
      descricao: entrada.descricao,
      itens: entrada.itens,
      vence_em: entrada.venceEm.toISOString(),
      origem: entrada.origem,
      criada_por: entrada.criadaPor,
      sessao_id: entrada.sessaoId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`não foi possível registrar a cobrança: ${error.message}`)
  return (data as { id: string }).id
}

export async function completarCobranca(
  id: string,
  doGateway: { pagamentoId: string; preferenciaId: string | null; pixCopiaCola: string | null; link: string | null },
): Promise<void> {
  const { error } = await db()
    .from('cobrancas')
    .update({
      pagamento_no_gateway: doGateway.pagamentoId,
      preferencia_no_gateway: doGateway.preferenciaId,
      pix_copia_cola: doGateway.pixCopiaCola,
      link: doGateway.link,
    })
    .eq('id', id)
  if (error) throw new Error(`não foi possível guardar o Pix da cobrança: ${error.message}`)
}

/** Só a que nunca chegou ao gateway: sem pagamento, nada foi cobrado de ninguém. */
export async function apagarCobrancaQueNaoSaiu(id: string): Promise<void> {
  await db().from('cobrancas').delete().eq('id', id).is('pagamento_no_gateway', null)
}

export async function acharCobranca(clienteId: string, id: string): Promise<CobrancaRegistrada | null> {
  const { data, error } = await db().from('cobrancas').select(COLUNAS).eq('cliente_id', clienteId).eq('id', id).maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler a cobrança: ${error.message}`)
  return data ? paraCobranca(data as Linha) : null
}

/**
 * Muda o status só se ele ainda for um dos `de`. Devolve se mudou: é o que diz
 * a quem chamou se ele é o primeiro a ver o pagamento, e portanto quem avisa a
 * conversa. O segundo aviso repetido recebe `false` e não faz nada.
 */
export async function mudarStatus(
  clienteId: string,
  id: string,
  de: StatusDeCobranca[],
  para: StatusDeCobranca,
  quando: Date = new Date(),
): Promise<boolean> {
  const extra =
    para === 'paga' ? { paga_em: quando.toISOString() } : para === 'cancelada' ? { cancelada_em: quando.toISOString() } : {}
  const { data, error } = await db()
    .from('cobrancas')
    .update({ status: para, ...extra })
    .eq('cliente_id', clienteId)
    .eq('id', id)
    .in('status', de)
    .select('id')
  if (error) throw new Error(`não foi possível mudar a cobrança para ${para}: ${error.message}`)
  return (data ?? []).length > 0
}

export type FiltroDeCobrancas = {
  status?: StatusDeCobranca
  contatoId?: string
  /** Criadas a partir de. */
  desde?: Date
  limite?: number
}

export async function listarCobrancas(clienteId: string, filtro: FiltroDeCobrancas = {}): Promise<CobrancaRegistrada[]> {
  let consulta = db()
    .from('cobrancas')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(filtro.limite ?? 200)
  if (filtro.status) consulta = consulta.eq('status', filtro.status)
  if (filtro.contatoId) consulta = consulta.eq('contato_id', filtro.contatoId)
  if (filtro.desde) consulta = consulta.gte('criado_em', filtro.desde.toISOString())
  const { data, error } = await consulta
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível listar as cobranças: ${error.message}`)
  return (data as Linha[]).map(paraCobranca)
}

/** O nome de cada contato cobrado, como a tela mostra: o corrigido quando existe, o do perfil quando não. */
export async function nomesDosCobrados(clienteId: string, contatoIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(contatoIds)]
  if (ids.length === 0) return new Map()
  const { data, error } = await db()
    .from('leads')
    .select('contact_id, nome, nome_real')
    .eq('client_id', clienteId)
    .in('contact_id', ids)
  if (error) throw new Error(`não foi possível ler os nomes dos contatos: ${error.message}`)
  return new Map(
    (data as { contact_id: string; nome: string | null; nome_real: string | null }[]).map((l) => [
      l.contact_id,
      l.nome_real?.trim() || l.nome?.trim() || '',
    ]),
  )
}
