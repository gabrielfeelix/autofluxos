import 'server-only'
import { ATO_DA_SUGESTAO } from '@/core/sugestoes'
import { db, ehIdInvalido } from '../db'

/**
 * As sugestões mandadas pelo "Sentiu falta de algo?", lidas da auditoria.
 * Ver `core/sugestoes.ts` para o porquê de não haver tabela própria.
 */
export type Sugestao = {
  id: string
  quando: string
  organizacaoId: string | null
  organizacaoNome: string
  quem: string
  email: string
  tela: string
  texto: string
}

type Linha = {
  id: string
  quando: string
  autor_email: string
  conta_id: string | null
  conta_nome: string
  alvo_nome: string
  detalhes: Record<string, unknown> | null
}

/** As mais novas primeiro. 500 é muito mais do que alguém lê de uma vez. */
export async function listarSugestoes(): Promise<Sugestao[]> {
  const { data, error } = await db()
    .from('af_auditoria')
    .select('id, quando, autor_email, conta_id, conta_nome, alvo_nome, detalhes')
    .eq('acao', ATO_DA_SUGESTAO)
    .order('quando', { ascending: false })
    .limit(500)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as sugestões: ${error.message}`)

  return (data as Linha[]).map((linha) => {
    const detalhes = linha.detalhes ?? {}
    const texto = typeof detalhes.texto === 'string' ? detalhes.texto : ''
    const nome = typeof detalhes.nome === 'string' ? detalhes.nome : ''
    const tela = typeof detalhes.tela === 'string' ? detalhes.tela : linha.alvo_nome
    return {
      id: linha.id,
      quando: linha.quando,
      organizacaoId: linha.conta_id,
      organizacaoNome: linha.conta_nome || 'Organização sem nome',
      quem: nome || linha.autor_email,
      email: linha.autor_email,
      tela,
      texto,
    }
  })
}
