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
  /** Handoff sem `resolvido_em`. `null` = ninguém esperando. */
  aguardando: { motivo: string; desde: string } | null
  criadoEm: string
}

export type Direcao = 'entrada' | 'saida'

export type MensagemDoLead = {
  id: string
  direcao: Direcao
  texto: string | null
  ts: string
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
  handoff_motivo: string | null
  handoff_em: string | null
}

// Numa linha só, e não concatenado: o supabase-js lê esta string no nível de
// tipo para saber o formato do retorno, e concatenação vira `string` genérica —
// aí o tipo do `data` desanda e o `tsc` acusa.
const COLUNAS =
  'contact_id, client_id, wa_id, nome, campos, criado_em, ultima_em, ultima_direcao, ultimo_texto, handoff_motivo, handoff_em'

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
    aguardando:
      linha.handoff_motivo && linha.handoff_em
        ? { motivo: linha.handoff_motivo, desde: linha.handoff_em }
        : null,
    criadoEm: linha.criado_em,
  }
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
  return (data as Linha[]).map(paraLead)
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
  return data ? paraLead(data as Linha) : null
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
    .select('id, direcao, texto, ts')
    .eq('contact_id', contatoId)
    .order('ts', { ascending: false })
    .limit(teto + 1)

  if (ehIdInvalido(error)) return { cortada: false, mensagens: [] }
  if (error) throw new Error(`não deu para ler a conversa: ${error.message}`)

  const linhas = data as { id: string; direcao: string; texto: string | null; ts: string }[]
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
      })),
  }
}
