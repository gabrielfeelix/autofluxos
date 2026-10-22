import 'server-only'
import type { Gateway } from '@/channels/pagamento'
import type { ModoDeMensalidade, StatusDeMensalidade } from '@/core/mensalidade'
import { db, ehIdInvalido } from '../db'

/**
 * As mensalidades (0145, `assinaturas`). Só a ida ao banco; quem decide o mês
 * e manda a cobrança é `server/mensalidades.ts`.
 */

export type Assinatura = {
  id: string
  clienteId: string
  contatoId: string
  produtoId: string | null
  descricao: string
  valorCentavos: number
  diaDoVencimento: number
  antecedenciaDias: number
  modo: ModoDeMensalidade
  status: StatusDeMensalidade
  gateway: Gateway | null
  idNoGateway: string | null
  linkDeAdesao: string | null
  inicio: string
  fim: string | null
  criadaPor: string | null
  criadoEm: string
}

type Linha = {
  id: string
  cliente_id: string
  contato_id: string
  produto_id: string | null
  descricao: string
  valor_centavos: number
  dia_do_vencimento: number
  antecedencia_dias: number
  modo: ModoDeMensalidade
  status: StatusDeMensalidade
  gateway: Gateway | null
  id_no_gateway: string | null
  link_de_adesao: string | null
  inicio: string
  fim: string | null
  criada_por: string | null
  criado_em: string
}

const COLUNAS =
  'id, cliente_id, contato_id, produto_id, descricao, valor_centavos, dia_do_vencimento, antecedencia_dias, modo, status, gateway, id_no_gateway, link_de_adesao, inicio, fim, criada_por, criado_em'

function paraAssinatura(l: Linha): Assinatura {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    contatoId: l.contato_id,
    produtoId: l.produto_id,
    descricao: l.descricao,
    valorCentavos: l.valor_centavos,
    diaDoVencimento: l.dia_do_vencimento,
    antecedenciaDias: l.antecedencia_dias,
    modo: l.modo,
    status: l.status,
    gateway: l.gateway,
    idNoGateway: l.id_no_gateway,
    linkDeAdesao: l.link_de_adesao,
    inicio: l.inicio,
    fim: l.fim,
    criadaPor: l.criada_por,
    criadoEm: l.criado_em,
  }
}

/** Código no ar antes da 0145 lê "nenhuma mensalidade". */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function inserirAssinatura(entrada: {
  clienteId: string
  contatoId: string
  produtoId: string | null
  descricao: string
  valorCentavos: number
  diaDoVencimento: number
  antecedenciaDias: number
  modo: ModoDeMensalidade
  status: StatusDeMensalidade
  gateway: Gateway | null
  inicio: string
  criadaPor: string | null
}): Promise<Assinatura> {
  const { data, error } = await db()
    .from('assinaturas')
    .insert({
      cliente_id: entrada.clienteId,
      contato_id: entrada.contatoId,
      produto_id: entrada.produtoId,
      descricao: entrada.descricao,
      valor_centavos: entrada.valorCentavos,
      dia_do_vencimento: entrada.diaDoVencimento,
      antecedencia_dias: entrada.antecedenciaDias,
      modo: entrada.modo,
      status: entrada.status,
      gateway: entrada.gateway,
      inicio: entrada.inicio,
      criada_por: entrada.criadaPor,
    })
    .select(COLUNAS)
    .single()
  if (error) throw new Error(`não foi possível criar a mensalidade: ${error.message}`)
  return paraAssinatura(data as Linha)
}

export async function acharAssinatura(clienteId: string, id: string): Promise<Assinatura | null> {
  const { data, error } = await db().from('assinaturas').select(COLUNAS).eq('cliente_id', clienteId).eq('id', id).maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler a mensalidade: ${error.message}`)
  return data ? paraAssinatura(data as Linha) : null
}

/** A mensalidade pela assinatura ou autorização no gateway: é como o aviso dele acha a nossa. */
export async function assinaturaNoGateway(gateway: Gateway, idNoGateway: string): Promise<Assinatura | null> {
  const { data, error } = await db().from('assinaturas').select(COLUNAS).eq('gateway', gateway).eq('id_no_gateway', idNoGateway).maybeSingle()
  if (tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler a mensalidade do gateway: ${error.message}`)
  return data ? paraAssinatura(data as Linha) : null
}

export async function assinaturasDoContato(clienteId: string, contatoId: string): Promise<Assinatura[]> {
  const { data, error } = await db()
    .from('assinaturas')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('contato_id', contatoId)
    .order('criado_em', { ascending: false })
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler as mensalidades: ${error.message}`)
  return (data as Linha[]).map(paraAssinatura)
}

/** As que o relógio olha todo dia, de todas as contas, em páginas. */
export async function assinaturasDoRelogio(depoisDe: string | null, limite: number): Promise<Assinatura[]> {
  let consulta = db()
    .from('assinaturas')
    .select(COLUNAS)
    // Ativas no Pix do mês e no Pix Automático, que o relógio cobra; e as que
    // aguardam adesão, que ele confere no gateway.
    .or('and(status.eq.ativa,modo.in.(pix_do_mes,pix_automatico)),status.eq.aguardando')
    .order('id', { ascending: true })
    .limit(limite)
  if (depoisDe) consulta = consulta.gt('id', depoisDe)
  const { data, error } = await consulta
  if (tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler as mensalidades do relógio: ${error.message}`)
  return (data as Linha[]).map(paraAssinatura)
}

/** Muda só a partir dos status que fazem sentido; `false` se nada mudou. */
export async function mudarStatusDaAssinatura(
  clienteId: string,
  id: string,
  de: StatusDeMensalidade[],
  para: StatusDeMensalidade,
  extra: { idNoGateway?: string | null; linkDeAdesao?: string | null; gateway?: Gateway | null } = {},
): Promise<boolean> {
  const { data, error } = await db()
    .from('assinaturas')
    .update({
      status: para,
      ...(para === 'cancelada' ? { cancelada_em: new Date().toISOString() } : {}),
      ...(extra.idNoGateway !== undefined ? { id_no_gateway: extra.idNoGateway } : {}),
      ...(extra.linkDeAdesao !== undefined ? { link_de_adesao: extra.linkDeAdesao } : {}),
      ...(extra.gateway !== undefined ? { gateway: extra.gateway } : {}),
    })
    .eq('cliente_id', clienteId)
    .eq('id', id)
    .in('status', de)
    .select('id')
  if (error) throw new Error(`não foi possível mudar a mensalidade: ${error.message}`)
  return (data ?? []).length > 0
}

/** Já existe cobrança desta mensalidade para este mês? */
export async function cobrancaDaCompetencia(assinaturaId: string, competencia: string): Promise<string | null> {
  const { data, error } = await db()
    .from('cobrancas')
    .select('id')
    .eq('assinatura_id', assinaturaId)
    .eq('competencia', competencia)
    .maybeSingle()
  if (error) throw new Error(`não foi possível ler a cobrança do mês: ${error.message}`)
  return (data as { id: string } | null)?.id ?? null
}
