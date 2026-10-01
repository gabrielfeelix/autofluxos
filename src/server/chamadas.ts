import 'server-only'
import { db } from './db'
import type { CanalDoSite } from './repos/canais-site'
import { enderecoDoVisitante } from './receber-do-site'

/**
 * Ligação de voz pelo chat do site (0118).
 *
 * O áudio vai de navegador para navegador por WebRTC. O servidor faz só o papel
 * de cartório: guarda a oferta do visitante, entrega ao atendente que atendeu,
 * guarda a resposta dele e devolve ao visitante. Cada lado junta todos os
 * candidatos ICE antes de mandar a descrição, então são duas escritas por
 * chamada, sem fila de mensagens e sem conexão aberta no servidor.
 *
 * Duas regras de acesso, as mesmas do resto do canal:
 * - o visitante só alcança chamada do **próprio** contato, achado pelo segredo
 *   (nunca por id de contato vindo do navegador);
 * - o atendente só alcança chamada da **conta** dele, e a oferta (que tem o IP
 *   do visitante dentro) só sai para quem atende.
 */

/** Sem resposta em 45 s, a chamada vira perdida. É o que um telefone espera. */
export const TEMPO_TOCANDO_MS = 45_000

/** Teto de SDP: uma descrição de áudio com candidatos cabe em 10 KB com folga. */
export const TETO_DO_SDP = 20_000

/**
 * Os servidores ICE dos dois lados. STUN público basta na maioria das redes;
 * rede de empresa e 4G com NAT simétrico precisam de TURN, que entra pela
 * variável `CHAMADA_ICE_SERVERS` (JSON no formato do `RTCIceServer`), sem
 * mudar código.
 */
export function servidoresIce(): { urls: string | string[]; username?: string; credential?: string }[] {
  const bruto = process.env.CHAMADA_ICE_SERVERS
  if (bruto) {
    try {
      const lido = JSON.parse(bruto)
      if (Array.isArray(lido) && lido.length) return lido
    } catch {
      console.error('[chamadas] CHAMADA_ICE_SERVERS não é JSON válido; seguindo só com STUN')
    }
  }
  return [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]
}

export type StatusDaChamada = 'chamando' | 'em_andamento' | 'encerrada' | 'perdida' | 'recusada'

type Linha = {
  id: string
  client_id: string
  contact_id: string
  status: StatusDaChamada
  oferta: string
  resposta: string | null
  criada_em: string
  atendida_em: string | null
}

const COLUNAS = 'id, client_id, contact_id, status, oferta, resposta, criada_em, atendida_em'

/** Tocando há mais que o prazo é perdida, gravado na primeira leitura depois. */
async function comPrazo(linha: Linha): Promise<Linha> {
  if (linha.status !== 'chamando' || Date.now() - Date.parse(linha.criada_em) < TEMPO_TOCANDO_MS) return linha
  await db()
    .from('chamadas')
    .update({ status: 'perdida', encerrada_em: new Date().toISOString() })
    .eq('id', linha.id)
    .eq('status', 'chamando')
  return { ...linha, status: 'perdida' }
}

async function contatoDoVisitante(canal: CanalDoSite, segredo: string): Promise<string | null> {
  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', canal.clienteId)
    .eq('wa_id', enderecoDoVisitante(canal.id, segredo))
    .maybeSingle()
  if (error) throw new Error(`não deu para achar o visitante: ${error.message}`)
  return data?.id ?? null
}

/* ------------------------------------------------------------------------ */
/* O lado do visitante                                                      */
/* ------------------------------------------------------------------------ */

export async function iniciarChamada(
  canal: CanalDoSite,
  segredo: string,
  oferta: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  if (!canal.config.ligacao) return { ok: false, motivo: 'A ligação não está disponível.' }

  // Contato sem conversa não liga: é o mesmo critério do formulário, e é o que
  // impede um robô de fazer o Inbox tocar sem nunca ter escrito.
  const contatoId = await contatoDoVisitante(canal, segredo)
  if (!contatoId) return { ok: false, motivo: 'Mande uma mensagem antes de ligar.' }

  // Uma chamada tocando por visitante: ligar de novo encerra a anterior.
  await db()
    .from('chamadas')
    .update({ status: 'encerrada', encerrada_em: new Date().toISOString() })
    .eq('contact_id', contatoId)
    .in('status', ['chamando', 'em_andamento'])

  const { data, error } = await db()
    .from('chamadas')
    .insert({ client_id: canal.clienteId, contact_id: contatoId, channel_id: canal.id, oferta })
    .select('id')
    .single()
  if (error) throw new Error(`não deu para abrir a chamada: ${error.message}`)
  return { ok: true, id: data.id }
}

async function chamadaDoVisitante(canal: CanalDoSite, segredo: string, id: string): Promise<Linha | null> {
  const contatoId = await contatoDoVisitante(canal, segredo)
  if (!contatoId) return null
  const { data } = await db()
    .from('chamadas')
    .select(COLUNAS)
    .eq('id', id)
    .eq('contact_id', contatoId)
    .maybeSingle()
  return data ? comPrazo(data as Linha) : null
}

export async function estadoParaVisitante(
  canal: CanalDoSite,
  segredo: string,
  id: string,
): Promise<{ status: StatusDaChamada; resposta: string | null } | null> {
  const linha = await chamadaDoVisitante(canal, segredo, id)
  return linha ? { status: linha.status, resposta: linha.resposta } : null
}

export async function encerrarPeloVisitante(canal: CanalDoSite, segredo: string, id: string): Promise<void> {
  const linha = await chamadaDoVisitante(canal, segredo, id)
  if (linha) await encerrar(linha)
}

/* ------------------------------------------------------------------------ */
/* O lado do atendente                                                      */
/* ------------------------------------------------------------------------ */

export type ChamadaTocando = { id: string; contatoId: string; nome: string; desde: string }

/** As que estão tocando nesta conta. É o que o Inbox pergunta a cada segundo. */
export async function chamadasTocando(clienteId: string): Promise<ChamadaTocando[]> {
  const desde = new Date(Date.now() - TEMPO_TOCANDO_MS).toISOString()
  const { data, error } = await db()
    .from('chamadas')
    .select('id, contact_id, criada_em, contacts!inner(nome, nome_real)')
    .eq('client_id', clienteId)
    .eq('status', 'chamando')
    .gt('criada_em', desde)
    .order('criada_em', { ascending: true })
    .limit(5)
  // Tabela ausente (migration ainda não aplicada) não pode derrubar o Inbox.
  if (error) return []
  return (data ?? []).map((linha) => {
    const contato = (Array.isArray(linha.contacts) ? linha.contacts[0] : linha.contacts) as
      | { nome: string | null; nome_real: string | null }
      | undefined
    return {
      id: linha.id,
      contatoId: linha.contact_id,
      nome: contato?.nome_real || contato?.nome || 'Visitante do site',
      desde: linha.criada_em,
    }
  })
}

async function chamadaDaConta(clienteId: string, id: string): Promise<Linha | null> {
  const { data } = await db().from('chamadas').select(COLUNAS).eq('id', id).eq('client_id', clienteId).maybeSingle()
  return data ? comPrazo(data as Linha) : null
}

export async function estadoParaAtendente(
  clienteId: string,
  id: string,
): Promise<{ status: StatusDaChamada; oferta: string | null; contatoId: string } | null> {
  const linha = await chamadaDaConta(clienteId, id)
  if (!linha) return null
  // A oferta só interessa enquanto dá para atender.
  return { status: linha.status, oferta: linha.status === 'chamando' ? linha.oferta : null, contatoId: linha.contact_id }
}

/**
 * Atender: grava a resposta só se ainda está tocando. Dois atendentes clicando
 * juntos, o primeiro leva; o segundo recebe "já atendida".
 */
export async function atender(
  clienteId: string,
  id: string,
  resposta: string,
  atendenteId: string | null,
): Promise<boolean> {
  const { data } = await db()
    .from('chamadas')
    .update({ status: 'em_andamento', resposta, atendente_id: atendenteId, atendida_em: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clienteId)
    .eq('status', 'chamando')
    .gt('criada_em', new Date(Date.now() - TEMPO_TOCANDO_MS).toISOString())
    .select('id')
    .maybeSingle()
  return Boolean(data)
}

export async function recusar(clienteId: string, id: string): Promise<void> {
  await db()
    .from('chamadas')
    .update({ status: 'recusada', encerrada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clienteId)
    .eq('status', 'chamando')
}

export async function encerrarPeloAtendente(clienteId: string, id: string): Promise<void> {
  const linha = await chamadaDaConta(clienteId, id)
  if (linha) await encerrar(linha)
}

async function encerrar(linha: Linha): Promise<void> {
  if (linha.status !== 'chamando' && linha.status !== 'em_andamento') return
  await db()
    .from('chamadas')
    .update({ status: linha.status === 'chamando' ? 'perdida' : 'encerrada', encerrada_em: new Date().toISOString() })
    .eq('id', linha.id)
    .in('status', ['chamando', 'em_andamento'])
}
