import 'server-only'
import { cache } from 'react'
import { PLANOS, ehRecursoDoPlano, type IdDoPlano, type Plano } from '@/core/planos'
import { db } from '../db'

/**
 * Os planos em vigor: da tabela `public.planos` (A6) ou, sem ela, do código.
 *
 * **A leitura de reserva é o que deixa o código subir antes da migration.** O
 * banco de produção é compartilhado com a Verandi e a migration só entra com
 * autorização explícita; até lá, `planos` não existe lá, e toda tela que lista
 * plano cairia. Então a falta da tabela (ou qualquer erro de leitura) devolve
 * `PLANOS` de `core/planos.ts`, que é exatamente o que valia antes.
 *
 * Os ids continuam os três de sempre (`essencial`, `operacao`, `escala`):
 * `clients.plano` guarda o id, e a tabela edita nome, preço, limites e o que
 * cada um libera, não inventa plano novo.
 */

export type PlanoVigente = Plano & { ativo: boolean; ordem: number; atualizadoEm: string | null }

type Linha = {
  id: string
  nome: string
  preco: number | string
  conversas: number | string
  numeros: number | string
  resumo: string | null
  itens: unknown
  recursos: unknown
  ativo: boolean
  ordem: number
  atualizado_em: string | null
}

function doCodigo(): PlanoVigente[] {
  return PLANOS.map((plano, ordem) => ({ ...plano, ativo: true, ordem, atualizadoEm: null }))
}

function paraPlano(linha: Linha): PlanoVigente {
  const base = PLANOS.find((plano) => plano.id === linha.id)
  const lista = (valor: unknown) => (Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [])
  return {
    id: linha.id as IdDoPlano,
    nome: linha.nome,
    preco: Number(linha.preco),
    conversas: Number(linha.conversas),
    numeros: Number(linha.numeros),
    resumo: linha.resumo ?? base?.resumo ?? '',
    itens: lista(linha.itens),
    recursos: lista(linha.recursos).filter(ehRecursoDoPlano),
    ativo: linha.ativo,
    ordem: linha.ordem,
    atualizadoEm: linha.atualizado_em,
  }
}

/** Se a tabela existe. Cacheado por requisição: várias telas perguntam. */
export const planosVigentes = cache(async (): Promise<PlanoVigente[]> => {
  try {
    const { data, error } = await db()
      .from('planos')
      .select('id, nome, preco, conversas, numeros, resumo, itens, recursos, ativo, ordem, atualizado_em')
      .order('ordem', { ascending: true })
    if (error || !data || data.length === 0) return doCodigo()
    return (data as Linha[]).map(paraPlano)
  } catch {
    return doCodigo()
  }
})

export async function tabelaDePlanosExiste(): Promise<boolean> {
  const { error } = await db().from('planos').select('id').limit(1)
  return !error
}

export async function planoVigente(id: string): Promise<PlanoVigente> {
  const todos = await planosVigentes()
  return todos.find((plano) => plano.id === id) ?? todos.find((plano) => plano.id === 'essencial') ?? todos[0]!
}

export type EdicaoDePlano = Pick<Plano, 'nome' | 'preco' | 'conversas' | 'numeros' | 'resumo' | 'itens' | 'recursos'> & { ativo: boolean }

export async function salvarPlano(id: IdDoPlano, edicao: EdicaoDePlano): Promise<{ ok: boolean; motivo?: string }> {
  const { error, count } = await db()
    .from('planos')
    .update(
      {
        nome: edicao.nome,
        preco: edicao.preco,
        conversas: edicao.conversas,
        numeros: edicao.numeros,
        resumo: edicao.resumo,
        itens: edicao.itens,
        recursos: edicao.recursos,
        ativo: edicao.ativo,
        atualizado_em: new Date().toISOString(),
      },
      { count: 'exact' },
    )
    .eq('id', id)
  if (error) {
    if (/planos/.test(error.message) && /(does not exist|schema cache|Could not find)/i.test(error.message)) {
      return { ok: false, motivo: 'a tabela de planos ainda não existe neste banco: a migration de planos não foi aplicada' }
    }
    return { ok: false, motivo: error.message }
  }
  if (count === 0) return { ok: false, motivo: 'esse plano não existe' }
  return { ok: true }
}
