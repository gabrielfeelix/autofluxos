import 'server-only'
import { cache } from 'react'
import { FUNCOES, FUNCOES_PADRAO, ehFuncao, type Funcao, type IdDaFuncao } from '@/core/funcoes'
import { CAPACIDADES, ehEscopo, type Politica } from '@/core/permissoes'
import { bancoDoLogin } from '../auth'
import { db } from '../db'

/**
 * As funções em vigor: da tabela `public.funcoes` (A7) ou, sem ela, do código.
 *
 * Mesma estratégia de `repos/planos.ts`: o código sobe antes da migration, e
 * enquanto a tabela não existe em produção as funções são as de
 * `FUNCOES_PADRAO`, que reproduzem exatamente os papéis e modelos de hoje.
 */

type Linha = { id: string; nome: string; nivel: number; descricao: string | null; capacidades: unknown; atualizado_em: string | null }

export type FuncoesVigentes = {
  /** A tabela existe? Decide se a função é lida de `af_membros.funcao_id`. */
  daTabela: boolean
  porId: Record<IdDaFuncao, Funcao & { atualizadoEm: string | null }>
}

function politicaDe(bruto: unknown, reserva: Politica): Politica {
  const objeto = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {}
  return Object.fromEntries(
    CAPACIDADES.map((capacidade) => {
      const valor = objeto[capacidade]
      return [capacidade, typeof valor === 'string' && ehEscopo(valor) ? valor : reserva[capacidade]]
    }),
  ) as Politica
}

function doCodigo(): FuncoesVigentes {
  return {
    daTabela: false,
    porId: Object.fromEntries(FUNCOES.map((id) => [id, { ...FUNCOES_PADRAO[id], atualizadoEm: null }])) as FuncoesVigentes['porId'],
  }
}

export const funcoesVigentes = cache(async (): Promise<FuncoesVigentes> => {
  try {
    const { data, error } = await db().from('funcoes').select('id, nome, nivel, descricao, capacidades, atualizado_em')
    if (error || !data) return doCodigo()
    const vigentes = doCodigo()
    vigentes.daTabela = true
    for (const linha of data as Linha[]) {
      if (!ehFuncao(linha.id)) continue
      const padrao = FUNCOES_PADRAO[linha.id]
      vigentes.porId[linha.id] = {
        id: linha.id,
        // O nível não é editável: ele é a regra de hierarquia, e trocar a
        // ordem das funções mudaria quem manda em quem sem ninguém perceber.
        nivel: padrao.nivel,
        nome: linha.nome || padrao.nome,
        descricao: linha.descricao ?? padrao.descricao,
        capacidades: politicaDe(linha.capacidades, padrao.capacidades),
        atualizadoEm: linha.atualizado_em,
      }
    }
    return vigentes
  } catch {
    return doCodigo()
  }
})

/** A função gravada de cada pessoa da organização (vazio sem a coluna). */
export const funcoesGravadas = cache(async (clienteId: string): Promise<Map<string, IdDaFuncao>> => {
  const { rows } = await bancoDoLogin().query(
    `select m."userId" as usuario, to_jsonb(m) ->> 'funcao_id' as funcao
       from public.af_membros m
      where m."organizationId" = $1`,
    [clienteId],
  )
  const mapa = new Map<string, IdDaFuncao>()
  for (const linha of rows) {
    const funcao = String(linha.funcao ?? '')
    if (ehFuncao(funcao)) mapa.set(String(linha.usuario), funcao)
  }
  return mapa
})

/** Grava a função da pessoa. `false` quando a coluna ainda não existe. */
export async function gravarFuncaoDoMembro(clienteId: string, usuarioId: string, funcao: IdDaFuncao): Promise<boolean> {
  try {
    const { rowCount } = await bancoDoLogin().query(
      `update public.af_membros set funcao_id = $3 where "organizationId" = $1 and "userId" = $2`,
      [clienteId, usuarioId, funcao],
    )
    return (rowCount ?? 0) === 1
  } catch {
    return false
  }
}

export async function salvarFuncao(
  id: IdDaFuncao,
  edicao: { descricao: string; capacidades: Politica },
): Promise<{ ok: boolean; motivo?: string }> {
  const { error, count } = await db()
    .from('funcoes')
    .update({ descricao: edicao.descricao, capacidades: edicao.capacidades, atualizado_em: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
  if (error) {
    if (/funcoes/.test(error.message) && /(does not exist|schema cache|Could not find)/i.test(error.message)) {
      return { ok: false, motivo: 'a tabela de funções ainda não existe neste banco: a migration de funções não foi aplicada' }
    }
    return { ok: false, motivo: error.message }
  }
  if (count === 0) return { ok: false, motivo: 'essa função não existe' }
  return { ok: true }
}
