import 'server-only'
import { validarSegmento, type Segmento } from '@/core/segmentos'
import { db, ehIdInvalido } from '../db'

/**
 * Os segmentos salvos (0083, RB-38).
 *
 * **Um segmento é regra, não lista.** Ele guarda a pergunta ("quem não compra
 * há 90 dias"), e a resposta é calculada toda vez. Guardar a resposta o
 * transformaria na lista materializada do envio, que é outro objeto, com outra
 * razão de existir: aquela é congelada de propósito, para rastreabilidade.
 *
 * A regra entra **validada** por `core/segmentos.ts`. O `jsonb` do banco
 * aceitaria qualquer coisa; quem recusa campo e operador desconhecidos é a
 * validação, e é por isso que ela roda aqui também, na leitura: um segmento
 * gravado por uma versão anterior do produto pode conter campo que não existe
 * mais, e devolvê-lo cru faria a consulta ignorá-lo em silêncio.
 */

export type SegmentoSalvo = {
  id: string
  nome: string
  descricao: string | null
  regra: Segmento
  criadoPor: string | null
  criadoEm: string
}

type Linha = {
  id: string
  nome: string
  descricao: string | null
  regra: unknown
  criado_por: string | null
  criado_em: string
}

const COLUNAS = 'id, nome, descricao, regra, criado_por, criado_em'

/**
 * Traduz a linha, **revalidando a regra**.
 *
 * Regra que não valida mais vira segmento vazio e o nome fica: some o filtro,
 * não o objeto. A alternativa seria devolver a regra crua e deixar a consulta
 * ignorar as condições desconhecidas, que é o pior dos dois mundos, a tela
 * diria "sem comprar há 90 dias" e traria todo mundo.
 */
function paraSegmento(linha: Linha): SegmentoSalvo {
  // `podeLerValores: true` aqui é leitura, não autorização: quem pode **usar**
  // um segmento com campo sensível é conferido na hora de consultar, por quem
  // sabe quem está perguntando.
  const validada = validarSegmento(linha.regra, { podeLerValores: true })

  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    regra: validada.ok ? validada.segmento : { juncao: 'todas', condicoes: [] },
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
  }
}

export async function listarSegmentos(clienteId: string): Promise<SegmentoSalvo[]> {
  const { data, error } = await db()
    .from('segmentos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('nome', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os segmentos: ${error.message}`)
  return (data as Linha[]).map(paraSegmento)
}

export async function acharSegmento(
  clienteId: string,
  segmentoId: string,
): Promise<SegmentoSalvo | null> {
  const { data, error } = await db()
    .from('segmentos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('id', segmentoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o segmento: ${error.message}`)
  return data ? paraSegmento(data as Linha) : null
}

export type ResultadoDoSegmento =
  | { ok: true; segmento: SegmentoSalvo }
  | { ok: false; motivo: string }

export async function criarSegmento(
  clienteId: string,
  nome: string,
  regra: Segmento,
  autor?: string | null,
): Promise<ResultadoDoSegmento> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'dê um nome ao segmento' }

  const { data, error } = await db()
    .from('segmentos')
    .insert({ client_id: clienteId, nome: limpo, regra, criado_por: autor ?? null })
    .select(COLUNAS)
    .single()

  if (error?.code === '23505') return { ok: false, motivo: `já existe um segmento "${limpo}"` }
  if (error) return { ok: false, motivo: `não deu para criar: ${error.message}` }
  return { ok: true, segmento: paraSegmento(data as Linha) }
}

/**
 * Salva a regra nova.
 *
 * **Isto não mexe em transmissão nenhuma**, e a ausência é a regra: uma
 * transmissão já confirmada tem a lista dela congelada em
 * `transmissao_destinatarios`, e editar o segmento depois não aumenta o lote
 * (RB-38). O `segmento_id` da transmissão é procedência, nunca fonte.
 */
export async function salvarRegra(
  clienteId: string,
  segmentoId: string,
  regra: Segmento,
  nome?: string,
): Promise<ResultadoDoSegmento> {
  const campos: Record<string, unknown> = {
    regra,
    atualizado_em: new Date().toISOString(),
  }
  if (nome !== undefined) {
    const limpo = nome.trim()
    if (limpo === '') return { ok: false, motivo: 'dê um nome ao segmento' }
    campos.nome = limpo
  }

  const { data, error } = await db()
    .from('segmentos')
    .update(campos)
    .eq('client_id', clienteId)
    .eq('id', segmentoId)
    .select(COLUNAS)
    .maybeSingle()

  if (error?.code === '23505') return { ok: false, motivo: 'já existe um segmento com esse nome' }
  if (ehIdInvalido(error)) return { ok: false, motivo: 'esse segmento não existe' }
  if (error) return { ok: false, motivo: `não deu para salvar: ${error.message}` }
  if (!data) return { ok: false, motivo: 'esse segmento não existe' }

  return { ok: true, segmento: paraSegmento(data as Linha) }
}

export async function apagarSegmento(clienteId: string, segmentoId: string): Promise<boolean> {
  // A transmissão que veio dele sobrevive: a FK é `on delete set null`, e a
  // lista dela continua sendo a verdade do que foi enviado.
  const { error } = await db()
    .from('segmentos')
    .delete()
    .eq('client_id', clienteId)
    .eq('id', segmentoId)

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar: ${error.message}`)
  return true
}
