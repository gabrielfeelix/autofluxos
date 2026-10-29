import 'server-only'
import { ATO_DA_SUGESTAO, ATO_DA_TRIAGEM, ehSituacaoDaSugestao, nomeDaTela, type SituacaoDaSugestao } from '@/core/sugestoes'
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
  imagem: string | null
  tela: string
  /** O nome que a tela tem no menu do cliente (`nomeDaTela`). */
  nomeDaTela: string
  texto: string
  situacao: SituacaoDaSugestao
  /** Quem da 4YU marcou a situação de agora, e quando. Vazio enquanto `nova`. */
  triadaPor: string
  triadaEm: string | null
}

type Linha = {
  id: string
  quando: string
  autor_id: string | null
  autor_email: string
  conta_id: string | null
  conta_nome: string
  alvo_id: string
  alvo_nome: string
  detalhes: Record<string, unknown> | null
}

const COLUNAS = 'id, quando, autor_id, autor_email, conta_id, conta_nome, alvo_id, alvo_nome, detalhes'

/** As mais novas primeiro. 500 é muito mais do que alguém lê de uma vez. */
export async function listarSugestoes(): Promise<Sugestao[]> {
  const [sugestoes, triagens] = await Promise.all([
    db().from('af_auditoria').select(COLUNAS).eq('acao', ATO_DA_SUGESTAO).order('quando', { ascending: false }).limit(500),
    db().from('af_auditoria').select(COLUNAS).eq('acao', ATO_DA_TRIAGEM).order('quando', { ascending: false }).limit(5000),
  ])

  if (ehIdInvalido(sugestoes.error)) return []
  if (sugestoes.error) throw new Error(`não foi possível ler as sugestões: ${sugestoes.error.message}`)
  if (triagens.error) throw new Error(`não foi possível ler a triagem das sugestões: ${triagens.error.message}`)

  // Vem da mais nova para a mais antiga: a primeira de cada sugestão é a que vale.
  const triagemDe = new Map<string, Linha>()
  for (const linha of (triagens.data ?? []) as Linha[]) {
    if (!triagemDe.has(linha.alvo_id)) triagemDe.set(linha.alvo_id, linha)
  }

  const linhas = (sugestoes.data ?? []) as Linha[]
  const autores = [...new Set(linhas.map((linha) => linha.autor_id).filter((id): id is string => !!id))]
  const imagens = new Map<string, string>()
  if (autores.length > 0) {
    const { data } = await db().from('af_usuarios').select('id, image').in('id', autores)
    for (const usuario of (data ?? []) as { id: string; image: string | null }[]) {
      if (usuario.image) imagens.set(usuario.id, usuario.image)
    }
  }

  return linhas.map((linha) => {
    const detalhes = linha.detalhes ?? {}
    const texto = typeof detalhes.texto === 'string' ? detalhes.texto : ''
    const nome = typeof detalhes.nome === 'string' ? detalhes.nome : ''
    const tela = typeof detalhes.tela === 'string' ? detalhes.tela : linha.alvo_nome
    const triagem = triagemDe.get(linha.id)
    const marcada = triagem?.detalhes?.situacao
    const situacao: SituacaoDaSugestao = ehSituacaoDaSugestao(marcada) ? marcada : 'nova'
    return {
      id: linha.id,
      quando: linha.quando,
      organizacaoId: linha.conta_id,
      organizacaoNome: linha.conta_nome || 'Organização sem nome',
      quem: nome || linha.autor_email,
      email: linha.autor_email,
      imagem: linha.autor_id ? (imagens.get(linha.autor_id) ?? null) : null,
      tela,
      nomeDaTela: nomeDaTela(tela),
      texto,
      situacao,
      triadaPor: triagem && situacao !== 'nova' ? triagem.autor_email : '',
      triadaEm: triagem && situacao !== 'nova' ? triagem.quando : null,
    }
  })
}

/** A sugestão pelo id, para a triagem não marcar linha que não é sugestão. */
export async function acharSugestao(id: string): Promise<{ id: string; contaId: string | null; contaNome: string } | null> {
  const { data, error } = await db()
    .from('af_auditoria')
    .select('id, conta_id, conta_nome')
    .eq('id', id)
    .eq('acao', ATO_DA_SUGESTAO)
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não foi possível ler a sugestão: ${error.message}`)
  if (!data) return null
  const linha = data as { id: string; conta_id: string | null; conta_nome: string }
  return { id: linha.id, contaId: linha.conta_id, contaNome: linha.conta_nome }
}
