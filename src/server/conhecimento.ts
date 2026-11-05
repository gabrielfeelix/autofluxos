import 'server-only'
import { consultaDe } from '@/core/conhecimento'
import type { OperacaoDeConhecimento } from '@/core/ferramentas'
import { db } from './db'

/**
 * Executa `consultar_material` na base de conhecimento da conta (0168).
 *
 * A conta é a da conversa, nunca do modelo: ele só escolhe as palavras, e as
 * palavras viram consulta limpa em `consultaDe`.
 */
export async function executarNoConhecimento(
  operacao: OperacaoDeConhecimento,
  valores: Record<string, string>,
  opcoes: { clienteId?: string },
): Promise<{ ok: true; json: unknown } | { ok: false; motivo: string }> {
  if (operacao !== 'buscar') return { ok: false, motivo: 'operação desconhecida' }
  if (!opcoes.clienteId) return { ok: false, motivo: 'a pesquisa no material só funciona numa conta' }
  const consulta = consultaDe(valores.termos ?? '')
  if (consulta === '') {
    return { ok: true, json: { trechos: [], aviso: 'Faltou o que pesquisar: chame consultar_material de novo com `termos` preenchido com as palavras-chave da pergunta.' } }
  }

  const { data, error } = await db().rpc('buscar_conhecimento', { p_cliente: opcoes.clienteId, p_consulta: consulta, p_limite: 5 })
  if (error) return { ok: false, motivo: 'a pesquisa no material falhou' }
  const trechos = (data ?? []) as { fonte: string; secao: string; pagina: number | null; texto: string }[]
  if (trechos.length === 0) {
    return { ok: true, json: { trechos: [], aviso: 'Nada encontrado. Tente sinônimos; se ainda vier vazio, diga que não encontrou isso no material.' } }
  }
  return {
    ok: true,
    json: { trechos: trechos.map((t) => ({ fonte: t.fonte, secao: t.secao, pagina: t.pagina ?? '', texto: t.texto })) },
  }
}
