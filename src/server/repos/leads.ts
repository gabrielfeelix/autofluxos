import 'server-only'
import { z } from 'zod'
import { db, ehIdInvalido } from '../db'

/**
 * Um lead é um contato visto pelo lado de quem vende: o que ele respondeu, se
 * alguém precisa assumir a conversa, e quando ele falou pela última vez.
 *
 * Nada aqui é tabela. É a view `leads` (0004), que junta `contacts`,
 * `messages` e `handoffs` — as duas últimas são agregações e o banco faz isso
 * melhor do que nós.
 */
export type Lead = {
  contatoId: string
  waId: string
  /** Vem do perfil do WhatsApp. `null` enquanto a Meta não mandar. */
  nome: string | null
  /** O que o fluxo coletou. As chaves mudam de fluxo para fluxo. */
  campos: Record<string, string>
  ultimaEm: string | null
  ultimaDirecao: Direcao | null
  ultimoTexto: string | null
  /** `false` quando a última saída não teve confirmação do canal. */
  ultimaEntregue: boolean | null
  /** Pausa persistente do bot para este contato. */
  automacaoAtiva: boolean
  /** Handoff sem `resolvido_em`. `null` = ninguém esperando. */
  aguardando: { motivo: string; desde: string } | null
  /** Sinais derivados do histórico; nunca são gravados de volta no contato. */
  etiquetas: EtiquetaDeLead[]
  criadoEm: string
}

export type Direcao = 'entrada' | 'saida'

export const ETIQUETAS_DE_LEAD = [
  'abriu_com_midia',
  'foi_para_pessoa',
  'nao_respondeu',
] as const

export type EtiquetaDeLead = (typeof ETIQUETAS_DE_LEAD)[number]

export type MensagemDoLead = {
  id: string
  direcao: Direcao
  texto: string | null
  ts: string
  /** Saídas que ainda não tiveram confirmação do canal não são entrega certa. */
  entregue: boolean
}

export type Conversa = {
  mensagens: MensagemDoLead[]
  /** `true` = a conversa é maior que o teto e o começo dela ficou de fora. */
  cortada: boolean
}

/** Teto de mensagens numa tela só. Quem estoura isso é avisado, não enganado. */
export const TETO_DE_MENSAGENS = 500

const direcaoSchema = z.enum(['entrada', 'saida'])

type Linha = {
  contact_id: string
  wa_id: string
  nome: string | null
  campos: unknown
  criado_em: string
  ultima_em: string | null
  ultima_direcao: string | null
  ultimo_texto: string | null
  ultima_entregue: boolean | null
  automacao_ativa: boolean
  handoff_motivo: string | null
  handoff_em: string | null
}

// Numa linha só, e não concatenado: o supabase-js lê esta string no nível de
// tipo para saber o formato do retorno, e concatenação vira `string` genérica —
// aí o tipo do `data` desanda e o `tsc` acusa.
const COLUNAS =
  'contact_id, client_id, wa_id, nome, campos, criado_em, ultima_em, ultima_direcao, ultimo_texto, handoff_motivo, handoff_em, ultima_entregue, automacao_ativa'

/**
 * `campos` é `jsonb`: o banco aceita qualquer coisa ali. Hoje só o motor
 * escreve, e sempre string — mas a tela de leads é justamente onde um dado
 * torto apareceria, e ela não pode ser a parte que quebra.
 *
 * Por isso a leitura é tolerante de propósito, ao contrário do grafo em
 * `fluxos.ts`: lá um rascunho inválido tem que estourar, porque o motor ia
 * executar aquilo. Aqui ninguém executa nada — é texto numa célula. Valor que
 * não é string vira JSON legível em vez de sumir; sumir seria perder o lead.
 */
const camposSchema = z.record(z.string(), z.unknown())

function paraCampos(bruto: unknown, waId: string): Record<string, string> {
  const analise = camposSchema.safeParse(bruto ?? {})
  if (!analise.success) {
    throw new Error(
      `os campos do contato ${waId} não são um objeto no banco: ${analise.error.issues[0]?.message}`,
    )
  }

  return Object.fromEntries(
    Object.entries(analise.data).map(([chave, valor]) => [
      chave,
      typeof valor === 'string' ? valor : JSON.stringify(valor),
    ]),
  )
}

function paraLead(linha: Linha): Lead {
  const direcao = direcaoSchema.safeParse(linha.ultima_direcao)

  return {
    contatoId: linha.contact_id,
    waId: linha.wa_id,
    nome: linha.nome,
    campos: paraCampos(linha.campos, linha.wa_id),
    ultimaEm: linha.ultima_em,
    ultimaDirecao: direcao.success ? direcao.data : null,
    ultimoTexto: linha.ultimo_texto,
    ultimaEntregue: linha.ultima_entregue,
    automacaoAtiva: linha.automacao_ativa,
    aguardando:
      linha.handoff_motivo && linha.handoff_em
        ? { motivo: linha.handoff_motivo, desde: linha.handoff_em }
        : null,
    etiquetas: [],
    criadoEm: linha.criado_em,
  }
}

function tipoDaMensagem(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null
  return typeof payload.type === 'string' ? payload.type : null
}

/**
 * Classifica pela história, não por uma cópia em `contacts.campos`.
 *
 * Assim uma resolução de handoff ou uma nova resposta muda o filtro na próxima
 * leitura sem sincronização. As consultas são por lote: o custo cresce em
 * linhas, não em uma ida ao banco por lead.
 */
async function classificar(leads: Lead[]): Promise<Lead[]> {
  if (leads.length === 0) return leads

  const contatos = leads.map((lead) => lead.contatoId)
  const [entradas, sessoes] = await Promise.all([
    db()
      .from('messages')
      .select('id, contact_id, payload, ts')
      .in('contact_id', contatos)
      .eq('direcao', 'entrada')
      .order('ts', { ascending: true })
      .order('id', { ascending: true }),
    db().from('sessions').select('id, contact_id').in('contact_id', contatos),
  ])

  if (entradas.error) {
    throw new Error(`não deu para classificar as mensagens dos leads: ${entradas.error.message}`)
  }
  if (sessoes.error) {
    throw new Error(`não deu para classificar os atendimentos dos leads: ${sessoes.error.message}`)
  }

  const contagemDeEntradas = new Map<string, number>()
  const primeiraEntrada = new Map<string, unknown>()
  for (const mensagem of entradas.data as { contact_id: string; payload: unknown }[]) {
    contagemDeEntradas.set(
      mensagem.contact_id,
      (contagemDeEntradas.get(mensagem.contact_id) ?? 0) + 1,
    )
    if (!primeiraEntrada.has(mensagem.contact_id)) {
      primeiraEntrada.set(mensagem.contact_id, mensagem.payload)
    }
  }

  const contatoPorSessao = new Map(
    (sessoes.data as { id: string; contact_id: string }[]).map((sessao) => [
      sessao.id,
      sessao.contact_id,
    ]),
  )
  const sessoesIds = [...contatoPorSessao.keys()]
  const contatosComHandoff = new Set<string>()

  if (sessoesIds.length > 0) {
    const { data, error } = await db()
      .from('handoffs')
      .select('session_id')
      .in('session_id', sessoesIds)

    if (error) throw new Error(`não deu para classificar os handoffs dos leads: ${error.message}`)
    for (const handoff of data as { session_id: string }[]) {
      const contatoId = contatoPorSessao.get(handoff.session_id)
      if (contatoId) contatosComHandoff.add(contatoId)
    }
  }

  return leads.map((lead) => {
    const etiquetas: EtiquetaDeLead[] = []
    const tipoInicial = tipoDaMensagem(primeiraEntrada.get(lead.contatoId))

    // É a mesma fronteira da entrada do motor: texto e resposta interativa são
    // conversa; áudio, imagem, localização e qualquer outro formato vão para
    // uma pessoa e contam como mídia aqui.
    if (tipoInicial && tipoInicial !== 'text' && tipoInicial !== 'interactive') {
      etiquetas.push('abriu_com_midia')
    }
    if (contatosComHandoff.has(lead.contatoId)) etiquetas.push('foi_para_pessoa')
    if (contagemDeEntradas.get(lead.contatoId) === 1) etiquetas.push('nao_respondeu')

    return { ...lead, etiquetas }
  })
}

/** Os leads do cliente, o mais recente primeiro. Quem nunca falou vai no fim. */
export async function listarLeads(clienteId: string): Promise<Lead[]> {
  const { data, error } = await db()
    .from('leads')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('ultima_em', { ascending: false, nullsFirst: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os leads: ${error.message}`)
  return classificar((data as Linha[]).map(paraLead))
}

/**
 * Um lead.
 *
 * Filtra por cliente **também**, e não só pelo id do contato: a URL é adivinhável
 * e um id de outro cliente não pode abrir só porque alguém o digitou.
 */
export async function acharLead(clienteId: string, contatoId: string): Promise<Lead | null> {
  const { data, error } = await db()
    .from('leads')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar o lead: ${error.message}`)
  if (!data) return null
  const [lead] = await classificar([paraLead(data as Linha)])
  return lead ?? null
}

/**
 * A conversa inteira, na ordem em que aconteceu.
 *
 * Lê do fim para o começo e devolve invertido: numa conversa longa o que
 * interessa é o que acabou de acontecer, não o "oi" de três meses atrás. Se
 * bater no teto, `cortada` avisa — teto silencioso mente dizendo que aquilo é
 * a conversa toda.
 */
export async function lerConversa(
  contatoId: string,
  teto: number = TETO_DE_MENSAGENS,
): Promise<Conversa> {
  const { data, error } = await db()
    .from('messages')
    .select('id, direcao, texto, ts, entregue')
    .eq('contact_id', contatoId)
    .order('ts', { ascending: false })
    .limit(teto + 1)

  if (ehIdInvalido(error)) return { cortada: false, mensagens: [] }
  if (error) throw new Error(`não deu para ler a conversa: ${error.message}`)

  const linhas = data as {
    id: string
    direcao: string
    texto: string | null
    ts: string
    entregue: boolean
  }[]
  const cortada = linhas.length > teto

  return {
    cortada,
    mensagens: linhas
      .slice(0, teto)
      .reverse()
      .map((m) => ({
        id: m.id,
        direcao: direcaoSchema.parse(m.direcao),
        texto: m.texto,
        ts: m.ts,
        entregue: m.entregue,
      })),
  }
}
