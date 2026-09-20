import 'server-only'
import {
  avaliar,
  prontoParaPublicar,
  type Avaliacao,
  type Condicao,
  type Criterios,
} from '@/core/qualificacao'
import { db, ehIdInvalido } from '../db'
import { camposDoContato } from './campos'

/**
 * Os critérios por objetivo e as avaliações versionadas (0078).
 *
 * A decisão mora em `core/qualificacao.ts`, porque é regra de produto e precisa
 * ser testável sem subir banco. O que acontece aqui é ler os critérios, ler os
 * campos, e **gravar o que foi usado** junto do resultado.
 */

type LinhaDosCriterios = {
  id: string
  objetivo: string
  versao: number
  modo: string
  condicoes: Condicao[] | null
  publicado: boolean
}

export async function criteriosDoObjetivo(
  clienteId: string,
  objetivo: string,
): Promise<Criterios | null> {
  const { data, error } = await db()
    .from('criterios_de_qualificacao')
    .select('id, objetivo, versao, modo, condicoes, publicado')
    .eq('client_id', clienteId)
    .eq('objetivo', objetivo)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler os critérios: ${error.message}`)
  if (!data) return null

  const linha = data as LinhaDosCriterios
  return {
    id: linha.id,
    versao: linha.versao,
    objetivo: linha.objetivo,
    modo: linha.modo === 'qualquer' ? 'qualquer' : 'todas',
    condicoes: linha.condicoes ?? [],
  }
}

export async function criteriosDaConta(clienteId: string): Promise<Criterios[]> {
  const { data, error } = await db()
    .from('criterios_de_qualificacao')
    .select('id, objetivo, versao, modo, condicoes, publicado')
    .eq('client_id', clienteId)
    .order('objetivo', { ascending: true })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para ler os critérios: ${error.message}`)
  }

  return ((data ?? []) as LinhaDosCriterios[]).map((linha) => ({
    id: linha.id,
    versao: linha.versao,
    objetivo: linha.objetivo,
    modo: linha.modo === 'qualquer' ? 'qualquer' : 'todas',
    condicoes: linha.condicoes ?? [],
  }))
}

/**
 * Publica uma versão dos critérios.
 *
 * **A versão sobe a cada publicação**, e é o que faz uma avaliação antiga
 * continuar explicável: ela guarda o número, e não o conteúdo, e o número diz
 * qual regra respondeu.
 *
 * Recusa o que não está pronto (RB-22): valores de demonstração não podem virar
 * política real. Devolve objeto com os problemas, e não booleano, porque a tela
 * precisa dizer **o que** falta.
 */
export async function publicarCriterios(
  clienteId: string,
  entrada: { objetivo: string; modo: 'todas' | 'qualquer'; condicoes: Condicao[] },
): Promise<{ ok: true; versao: number } | { ok: false; problemas: string[] }> {
  const objetivo = entrada.objetivo.trim()
  if (objetivo === '') return { ok: false, problemas: ['escolha o objetivo destes critérios'] }

  const atual = await criteriosDoObjetivo(clienteId, objetivo)
  const proposta: Criterios = {
    id: atual?.id ?? '',
    versao: (atual?.versao ?? 0) + 1,
    objetivo,
    modo: entrada.modo,
    condicoes: entrada.condicoes,
  }

  const pronto = prontoParaPublicar(proposta)
  if (!pronto.pronto) return { ok: false, problemas: pronto.problemas }

  const { error } = await db()
    .from('criterios_de_qualificacao')
    .upsert(
      {
        client_id: clienteId,
        objetivo,
        versao: proposta.versao,
        modo: proposta.modo,
        condicoes: proposta.condicoes,
        publicado: true,
      },
      { onConflict: 'client_id,objetivo' },
    )

  if (error) return { ok: false, problemas: [`não deu para gravar: ${error.message}`] }
  return { ok: true, versao: proposta.versao }
}

/**
 * Avalia um contato para um objetivo, e grava a avaliação.
 *
 * **Reavaliar gera linha nova, nunca reescreve.** A anterior é o que a regra da
 * época respondeu, e apagá-la é apagar a explicação de uma decisão que alguém
 * tomou. A tela mostra a última e o histórico continua lá.
 */
export async function avaliarContato(
  clienteId: string,
  contatoId: string,
  objetivo: string,
  autorId: string | null,
): Promise<{ ok: true; avaliacao: Avaliacao } | { ok: false; motivo: string }> {
  const [criterios, campos] = await Promise.all([
    criteriosDoObjetivo(clienteId, objetivo),
    camposDoContato(clienteId, contatoId),
  ])

  if (campos === null) return { ok: false, motivo: 'este contato não é deste cliente' }
  if (!criterios) return { ok: false, motivo: 'esta conta não tem critérios para esse objetivo' }

  const avaliacao = avaliar(criterios, campos)

  /*
   * Os valores considerados vão congelados para a linha. O campo pode ser
   * corrigido depois, e sem isto a avaliação antiga passaria a parecer errada:
   * "não atende porque o orçamento é 300" com o campo já mostrando 900.
   *
   * Só as chaves que a regra olhou: gravar o mapa inteiro copiaria dado pessoal
   * que a avaliação não usou para dentro de uma tabela de histórico.
   */
  const valores: Record<string, string> = {}
  for (const condicao of criterios.condicoes) {
    const valor = campos[condicao.campo]?.valor
    if (valor !== undefined) valores[condicao.campo] = valor
  }

  const { error } = await db().from('avaliacoes_de_qualificacao').insert({
    client_id: clienteId,
    contact_id: contatoId,
    criterios_id: criterios.id,
    criterios_versao: avaliacao.criteriosVersao,
    objetivo: avaliacao.objetivo,
    resultado: avaliacao.resultado,
    motivos: avaliacao.motivos,
    faltam: avaliacao.faltam,
    valores,
    autor_id: autorId,
  })

  if (error) return { ok: false, motivo: `não deu para gravar a avaliação: ${error.message}` }
  return { ok: true, avaliacao }
}

export type AvaliacaoGravada = Avaliacao & { criadoEm: string; valores: Record<string, string> }

type LinhaDaAvaliacao = {
  criterios_id: string | null
  criterios_versao: number
  objetivo: string
  resultado: string
  motivos: string[] | null
  faltam: string[] | null
  valores: Record<string, string> | null
  criado_em: string
}

/**
 * As últimas avaliações do contato, uma por objetivo.
 *
 * Uma por objetivo, e não uma só: a mesma pessoa pode atender ao Plano Básico e
 * não ao Premium, e as duas respostas são verdadeiras ao mesmo tempo. Devolver
 * "a última" sem separar por objetivo faria a tela dizer que a pessoa não
 * atende a algo que ninguém avaliou.
 */
export async function avaliacoesDoContato(
  clienteId: string,
  contatoId: string,
): Promise<AvaliacaoGravada[]> {
  const { data, error } = await db()
    .from('avaliacoes_de_qualificacao')
    .select('criterios_id, criterios_versao, objetivo, resultado, motivos, faltam, valores, criado_em')
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .order('criado_em', { ascending: false })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para ler as avaliações: ${error.message}`)
  }

  const porObjetivo = new Map<string, AvaliacaoGravada>()
  for (const bruta of (data ?? []) as LinhaDaAvaliacao[]) {
    // Ordenado do mais novo para o mais antigo: o primeiro de cada objetivo é a
    // última avaliação dele, e os outros são o histórico.
    if (porObjetivo.has(bruta.objetivo)) continue
    porObjetivo.set(bruta.objetivo, {
      resultado: bruta.resultado as Avaliacao['resultado'],
      motivos: bruta.motivos ?? [],
      faltam: bruta.faltam ?? [],
      criteriosId: bruta.criterios_id ?? '',
      criteriosVersao: bruta.criterios_versao,
      objetivo: bruta.objetivo,
      valores: bruta.valores ?? {},
      criadoEm: bruta.criado_em,
    })
  }

  return [...porObjetivo.values()]
}
